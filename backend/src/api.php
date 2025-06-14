<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Log the request
error_log("Request received: " . $_SERVER['REQUEST_METHOD'] . " " . $_SERVER['REQUEST_URI']);

// Set headers
header('Content-Type: application/json');

// Basic response for testing
if ($_SERVER['REQUEST_URI'] === '/api/test') {
    echo json_encode(['message' => 'API is working!']);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the request path
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$path = str_replace('/api/', '', $path);

error_log("Processed path: " . $path);

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Get request body for POST requests
$body = [];
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
}

try {
    $db = Database::getInstance();

    // Route handling
    switch ("$method $path") {
        case 'GET test':
            error_log("Handling test endpoint");
            echo json_encode(['message' => 'API is working!']);
            break;

        case 'GET rides':
            $result = $db->query('SELECT * FROM rides ORDER BY date DESC');
            $rides = [];
            while ($row = $result->fetch_assoc()) {
                $rides[] = $row;
            }
            echo json_encode($rides);
            break;

        case 'GET rides/unexported':
            $result = $db->query('
                SELECT r.* 
                FROM rides r 
                LEFT JOIN exported_items ei ON r.id = ei.item_id AND ei.item_type = "ride"
                WHERE ei.id IS NULL
                ORDER BY r.date DESC
            ');
            $rides = [];
            while ($row = $result->fetch_assoc()) {
                $rides[] = $row;
            }
            echo json_encode($rides);
            break;

        case 'POST rides':
            if (!isset($body['driver']) || !isset($body['distance']) || !isset($body['date'])) {
                throw new Exception('Missing required fields');
            }
            
            $date = date('Y-m-d H:i:s', strtotime($body['date']));
            $db->query(
                'INSERT INTO rides (driver, distance, date) VALUES (?, ?, ?)',
                [$body['driver'], $body['distance'], $date]
            );
            
            echo json_encode(['id' => $db->getLastInsertId()]);
            break;

        case 'GET expenses':
            $result = $db->query('SELECT * FROM expenses ORDER BY date DESC');
            $expenses = [];
            while ($row = $result->fetch_assoc()) {
                $expenses[] = $row;
            }
            echo json_encode($expenses);
            break;

        case 'POST expenses':
            if (!isset($body['amount']) || !isset($body['description']) || 
                !isset($body['date']) || !isset($body['rideIds']) || !isset($body['payer'])) {
                throw new Exception('Missing required fields');
            }

            $db->beginTransaction();
            try {
                // Insert expense
                $date = date('Y-m-d', strtotime($body['date']));
                $db->query(
                    'INSERT INTO expenses (amount, description, date, payer) VALUES (?, ?, ?, ?)',
                    [$body['amount'], $body['description'], $date, $body['payer']]
                );
                $expenseId = $db->getLastInsertId();

                // Get total distance of selected rides
                $rideIds = implode(',', $body['rideIds']);
                $result = $db->query("SELECT distance, driver FROM rides WHERE id IN ($rideIds)");
                $rides = [];
                $totalDistance = 0;
                while ($row = $result->fetch_assoc()) {
                    $rides[] = $row;
                    $totalDistance += $row['distance'];
                }

                // Calculate percentages and insert links
                foreach ($body['rideIds'] as $rideId) {
                    $result = $db->query('SELECT distance FROM rides WHERE id = ?', [$rideId]);
                    $ride = $result->fetch_assoc();
                    $percentage = ($ride['distance'] / $totalDistance) * 100;

                    $db->query(
                        'INSERT INTO ride_expense_link (ride_id, expense_id, percentage) VALUES (?, ?, ?)',
                        [$rideId, $expenseId, $percentage]
                    );
                }

                // Calculate and store balances
                $driverShares = [];
                foreach ($rides as $ride) {
                    $share = ($ride['distance'] / $totalDistance) * $body['amount'];
                    $driverShares[$ride['driver']] = ($driverShares[$ride['driver']] ?? 0) + $share;
                }

                foreach ($driverShares as $driver => $share) {
                    if ($driver !== $body['payer']) {
                        $db->query(
                            'INSERT INTO expense_balances (expense_id, from_user, to_user, amount) VALUES (?, ?, ?, ?)',
                            [$expenseId, $driver, $body['payer'], $share]
                        );
                    }
                }

                $db->commit();
                echo json_encode(['message' => 'Expense added successfully']);
            } catch (Exception $e) {
                $db->rollback();
                throw $e;
            }
            break;

        case 'GET summary':
            $result = $db->query('
                SELECT 
                    e.id,
                    e.amount,
                    e.description,
                    e.date,
                    e.payer,
                    GROUP_CONCAT(DISTINCT r.driver) as drivers,
                    GROUP_CONCAT(DISTINCT eb.from_user) as from_users,
                    GROUP_CONCAT(DISTINCT eb.to_user) as to_users,
                    GROUP_CONCAT(DISTINCT eb.amount) as balance_amounts
                FROM expenses e
                LEFT JOIN ride_expense_link rel ON e.id = rel.expense_id
                LEFT JOIN rides r ON rel.ride_id = r.id
                LEFT JOIN expense_balances eb ON e.id = eb.expense_id
                GROUP BY e.id
                ORDER BY e.date DESC
            ');

            $summary = [];
            while ($row = $result->fetch_assoc()) {
                $summary[] = $row;
            }
            echo json_encode($summary);
            break;

        case 'GET total-balances':
            $result = $db->query('
                SELECT 
                    from_user,
                    to_user,
                    SUM(amount) as total_amount
                FROM expense_balances
                GROUP BY from_user, to_user
                ORDER BY from_user, to_user
            ');

            $balances = [];
            while ($row = $result->fetch_assoc()) {
                $balances[] = $row;
            }
            echo json_encode($balances);
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
            break;
    }
} catch (Exception $e) {
    error_log("Error occurred: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} 