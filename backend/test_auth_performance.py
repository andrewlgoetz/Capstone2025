import requests
import time
import statistics

# Configuration
BASE_URL = "http://127.0.0.1:8000" 
LOGIN_ENDPOINT = f"{BASE_URL}/auth/login"
NUM_ATTEMPTS = 50 # 50 handshakes provides a statistically significant sample

# --- TEST USER CREDENTIALS ---
# Must be a user that actually exists in your local Postgres database
TEST_EMAIL = "admin@hamfoodbank.ca" 
TEST_PASSWORD = "admin123" 

def run_auth_performance_test():
    print(f"Starting Security Latency test: {NUM_ATTEMPTS} login handshakes on {LOGIN_ENDPOINT}...")
    
    auth_data = {
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response_times_ms = []
    
    for i in range(NUM_ATTEMPTS):
        start_time = time.time() 
        
        try:
            response = requests.post(LOGIN_ENDPOINT, data=auth_data)
            response.raise_for_status() 
        except requests.exceptions.RequestException as e:
            print(f"Request {i+1} failed: {e}")
            return
            
        end_time = time.time() 
        
        time_taken_ms = (end_time - start_time) * 1000
        response_times_ms.append(time_taken_ms)

        if (i + 1) % 10 == 0:
            print(f"  ... completed {i + 1}/{NUM_ATTEMPTS} handshakes")
        
    # Calculate final V&V metrics
    avg_time = statistics.mean(response_times_ms)
    max_time = max(response_times_ms)
    min_time = min(response_times_ms)
    p95_time = statistics.quantiles(response_times_ms, n=20)[18] 
    
    print("\n--- Security Latency Results ---")
    print(f"Target Goal: < 100.00 ms")
    print(f"Average Handshake: {avg_time:.2f} ms")
    print(f"Min Handshake:     {min_time:.2f} ms")
    print(f"Max Handshake:     {max_time:.2f} ms")
    print(f"95th Percentile:   {p95_time:.2f} ms")
    
    if p95_time < 100:
        print("\n✅ STATUS: PASSED. 95% of security handshakes completed well under the 100ms threshold.")
    else:
        print("\n❌ STATUS: FAILED. Login security checks exceeded the 100ms threshold.")

if __name__ == "__main__":
    run_auth_performance_test()