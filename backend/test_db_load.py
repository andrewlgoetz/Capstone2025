import requests
import time
import concurrent.futures
import statistics

# --- CONFIGURATION ---
BASE_URL = "http://127.0.0.1:8000" 
LOGIN_ENDPOINT = f"{BASE_URL}/auth/login"
TEST_ENDPOINT = f"{BASE_URL}/inventory/all" 
NUM_CONCURRENT_REQUESTS = 50

# --- TEST USER CREDENTIALS ---
EMAIL = "admin@hamfoodbank.ca"
PASSWORD = "admin123"

def get_auth_token():
    """Logs in to the system to retrieve a valid JWT token."""
    print(f"Attempting to authenticate user: {EMAIL}...")
    try:
        response = requests.post(
            LOGIN_ENDPOINT, 
            data={"username": EMAIL, "password": PASSWORD}
        )
        response.raise_for_status()
        token = response.json().get("access_token")
        print("✅ Authentication successful. Token acquired.\n")
        return token
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return None

def fetch_data(request_id, token):
    """Simulates a single authorized volunteer querying the database."""
    headers = {"Authorization": f"Bearer {token}"}
    start_time = time.time()
    status = "ERROR"
    detail = ""
    try:
        response = requests.get(TEST_ENDPOINT, headers=headers)
        status = response.status_code
        if status != 200:
            detail = response.text
    except Exception as e:
        detail = str(e)
    end_time = time.time()
    
    return (end_time - start_time) * 1000, status, detail

def run_capacity_test():
    token = get_auth_token()
    if not token:
        print("Aborting test: Could not obtain a valid security token.")
        return

    print(f"Starting Database Capacity Test...")
    print(f"URL being tested: {TEST_ENDPOINT}")
    print(f"Simulating {NUM_CONCURRENT_REQUESTS} simultaneous database queries...")
    
    response_times = []
    success_count = 0
    errors = set()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_CONCURRENT_REQUESTS) as executor:
        future_to_req = {executor.submit(fetch_data, i, token): i for i in range(NUM_CONCURRENT_REQUESTS)}
        
        for future in concurrent.futures.as_completed(future_to_req):
            time_taken, status, detail = future.result()
            response_times.append(time_taken)
            if status == 200:
                success_count += 1
            else:
                errors.add(f"Status {status}: {detail}")

    if errors:
        print("\n--- Error Details ---")
        for err in errors:
            print(f"  {err}")

    # Calculate final metrics
    avg_time = statistics.mean(response_times)
    max_time = max(response_times)
    p95_time = statistics.quantiles(response_times, n=20)[18]
    
    print("\n--- Database Load Results ---")
    print(f"Total Requests:      {NUM_CONCURRENT_REQUESTS}")
    print(f"Successful Resolves: {success_count}/{NUM_CONCURRENT_REQUESTS}")
    print(f"Target Goal:         < 500 ms p95")
    print(f"Average Latency:     {avg_time:.2f} ms")
    print(f"Max Latency:         {max_time:.2f} ms")
    print(f"95th Percentile:     {p95_time:.2f} ms")
    
    if success_count == NUM_CONCURRENT_REQUESTS and p95_time < 500:
        print("\n✅ STATUS: PASSED. Database handled concurrent load with valid auth.")
    else:
        print("\n❌ STATUS: FAILED. Check 'Error Details' above.")

if __name__ == "__main__":
    run_capacity_test()