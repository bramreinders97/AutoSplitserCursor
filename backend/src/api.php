<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace('/api/', '', $path);
$method = $_SERVER['REQUEST_METHOD'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$db = Database::getInstance();

function respond($data) {
    echo json_encode($data);
    exit();
}

try {
    switch ("$method $path") {
        case 'GET test':
            respond(['message' => 'API is working!']);

        case 'GET rides':
            respond($db->queryAll('SELECT * FROM rides ORDER BY date DESC'));

        case 'POST rides':
            $driver = $body['driver'];
            $distance = $body['distance'];
            $date = date('Y-m-d H:i:s', strtotime($body['date']));
            $db->query('INSERT INTO rides (driver, distance, date) VALUES (?, ?, ?)', [$driver, $distance, $date]);
            respond(['id' => $db->getLastInsertId()]);

        case 'GET expenses':
            respond($db->queryAll('SELECT * FROM expenses ORDER BY date DESC'));

        case 'POST expenses':
            $amount = $body['amount'];
            $description = $body['description'];
            $payer = $body['payer'];
            $rideIds = $body['rideIds'];
            $date = date('Y-m-d', strtotime($body['date']));
            $db->beginTransaction();

            try {
                $db->query('INSERT INTO expenses (amount, description, date, payer) VALUES (?, ?, ?, ?)', [$amount, $description, $date, $payer]);
                $expenseId = $db->getLastInsertId();

                $placeholders = implode(',', array_fill(0, count($rideIds), '?'));
                $rides = $db->queryAll("SELECT id, distance, driver FROM rides WHERE id IN ($placeholders)", $rideIds);
                $totalDistance = array_sum(array_column($rides, 'distance'));

                foreach ($rides as $ride) {
                    $percentage = ($ride['distance'] / $totalDistance) * 100;
                    $db->query('INSERT INTO ride_expense_link (ride_id, expense_id, percentage) VALUES (?, ?, ?)', [$ride['id'], $expenseId, $percentage]);
                }

                $shares = [];
                foreach ($rides as $ride) {
                    $share = ($ride['distance'] / $totalDistance) * $amount;
                    $shares[$ride['driver']] = ($shares[$ride['driver']] ?? 0) + $share;
                }

                foreach ($shares as $driver => $share) {
                    if ($driver !== $payer) {
                        $db->query('INSERT INTO expense_balances (expense_id, from_user, to_user, amount) VALUES (?, ?, ?, ?)', [$expenseId, $driver, $payer, $share]);
                    }
                }

                $db->commit();
                respond(['message' => 'Expense added successfully']);
            } catch (Exception $e) {
                $db->rollback();
                throw $e;
            }

        case 'GET summary':
            $summary = $db->queryAll('
                SELECT 
                    e.id as expense_id,
                    e.description as expense_description,
                    eb.from_user,
                    eb.to_user,
                    eb.amount,
                    e.amount as total_amount
                FROM expenses e
                JOIN expense_balances eb ON e.id = eb.expense_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM exported_items ei 
                    WHERE ei.item_type = "expense" AND ei.item_id = e.id
                )
                ORDER BY e.created_at DESC
            ');
            foreach ($summary as &$row) {
                $row['amount'] = number_format((float)$row['amount'], 2, '.', '');
                $row['total_amount'] = number_format((float)$row['total_amount'], 2, '.', '');
            }
            respond($summary);

        case 'GET rides/linked':
            respond($db->queryAll('
                SELECT DISTINCT r.* 
                FROM rides r
                INNER JOIN ride_expense_link rel ON r.id = rel.ride_id
            '));

        case 'GET expense-balances':
            respond($db->queryAll('
                SELECT DISTINCT
                    e.id as expense_id,
                    e.description,
                    e.date,
                    CAST(e.amount AS DECIMAL(10,2)) as total_amount,
                    eb.from_user,
                    eb.to_user,
                    CAST(eb.amount AS DECIMAL(10,2)) as balance_amount
                FROM expenses e
                JOIN expense_balances eb ON e.id = eb.expense_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM exported_items ei 
                    WHERE ei.item_type = "expense" AND ei.item_id = e.id
                )
                ORDER BY e.date DESC, e.id DESC
            '));

        case 'GET total-balances':
            respond($db->queryAll('
                SELECT 
                    from_user,
                    to_user,
                    SUM(amount) as total_amount
                FROM expense_balances eb
                WHERE NOT EXISTS (
                    SELECT 1 FROM exported_items ei 
                    WHERE ei.item_type = "balance" AND ei.item_id = eb.id
                )
                GROUP BY from_user, to_user
            '));

        case 'GET rides/unexported':
            respond($db->queryAll('
                SELECT 
                    r.id,
                    r.driver,
                    r.distance,
                    r.date,
                    r.created_at,
                    e.id as expense_id,
                    e.description as expense_description
                FROM rides r
                LEFT JOIN ride_expense_link rel ON r.id = rel.ride_id
                LEFT JOIN expenses e ON rel.expense_id = e.id
                WHERE r.id NOT IN (SELECT item_id FROM exported_items WHERE item_type = "ride")
                ORDER BY r.date DESC
            '));

        default:
            http_response_code(404);
            respond(['error' => 'Endpoint not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    respond(['error' => $e->getMessage()]);
}
