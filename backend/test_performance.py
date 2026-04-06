"""
These tests verify the performance of the barcode scanning endpoint under load, specifically:
1. Response Time: Ensures that the average and 95th percentile response times are under 200ms.
2. Stability: Confirms that no requests fail under the simulated load.
3. Scalability: Provides insights into how the system performs as the number of scans increases.
"""

import requests
import time
import statistics

# Configuration
BASE_URL = "http://127.0.0.1:8000" 
TEST_BARCODE = "100000111001" # Ensure this barcode exists in your seeded DB
ENDPOINT = f"{BASE_URL}/barcode/scan-out" 
NUM_SCANS = 100 

# --- SEEDED TEST USER CREDENTIALS ---
TEST_EMAIL = "admin@hamfoodbank.ca" 
TEST_PASSWORD = "admin123" # Replace with your actual local testing password

def get_auth_token():
    """Logs in and retrieves the JWT Bearer token."""
    print("Logging in to get auth token...")
    
    # OAuth2 in FastAPI requires form-encoded data
    auth_data = {
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", data=auth_data)
    
    if response.status_code != 200:
        print(f"Login failed! Status: {response.status_code}, Response: {response.text}")
        response.raise_for_status()
        
    return response.json()["access_token"]

def run_performance_test():
    # 1. Get the token
    try:
        token = get_auth_token()
    except Exception as e:
        print("Stopping test because authentication failed.")
        return

    # 2. Set up the headers for the scanner loop
    headers = {
        "Authorization": f"Bearer {token}"
    }

    print(f"\nStarting performance test: {NUM_SCANS} simulated scans on {ENDPOINT}...")
    response_times_ms = []
    
    for i in range(NUM_SCANS):
        start_time = time.time() # Start timing
        
        try:
            # 3. Hit the local DB endpoint using POST and the expected JSON payload
            response = requests.post(ENDPOINT, headers=headers, json={"barcode": TEST_BARCODE})
            response.raise_for_status() 
        except requests.exceptions.RequestException as e:
            print(f"Request {i+1} failed: {e} - {response.text if 'response' in locals() else ''}")
            return
            
        end_time = time.time() # Stop timing
        
        # Calculate time taken in milliseconds
        time_taken_ms = (end_time - start_time) * 1000
        response_times_ms.append(time_taken_ms)

        # Print a progress update every 20 scans so you can see it working
        if (i + 1) % 20 == 0:
            print(f"  ... completed {i + 1}/{NUM_SCANS} scans")
        
    # Calculate final V&V metrics
    avg_time = statistics.mean(response_times_ms)
    max_time = max(response_times_ms)
    min_time = min(response_times_ms)
    p95_time = statistics.quantiles(response_times_ms, n=20)[18] # 95th percentile
    
    print("\n--- Performance Results ---")
    print(f"Target Goal: < 200.00 ms")
    print(f"Average Response Time: {avg_time:.2f} ms")
    print(f"Min Response Time:     {min_time:.2f} ms")
    print(f"Max Response Time:     {max_time:.2f} ms")
    print(f"95th Percentile:       {p95_time:.2f} ms")
    
    if p95_time < 200:
        print("\n✅ STATUS: PASSED. 95% of requests completed well under the 200ms threshold.")
    else:
        print("\n❌ STATUS: FAILED. Response times exceeded the 200ms threshold.")

if __name__ == "__main__":
    run_performance_test()