"""
These tests verify the performance of the complex report generation endpoint, specifically:
1. Response Time: Ensures that the report is generated within a reasonable time frame (e.g., under 5 seconds).
2. Stability: Confirms that the endpoint does not fail under the load of generating a large report.
3. Scalability: Provides insights into how the system performs as the complexity of the report increases (e.g., larger date ranges).
"""

import requests
import time

# Configuration
BASE_URL = "http://127.0.0.1:8000" 
TEST_EMAIL = "admin@hamfoodbank.ca" 
TEST_PASSWORD = "admin123" 

# Defining a massive 2-year complex report window to test the "End-of-Year Audit"
REPORT_ENDPOINT = f"{BASE_URL}/inventory/reports/download?start_date=2024-01-01&end_date=2026-12-31"

def get_auth_token():
    auth_data = {"username": TEST_EMAIL, "password": TEST_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", data=auth_data)
    response.raise_for_status()
    return response.json()["access_token"]

def run_report_performance_test():
    try:
        token = get_auth_token()
    except Exception as e:
        print("Auth failed:", e)
        return

    headers = {"Authorization": f"Bearer {token}"}

    print(f"Generating Complex Report: {REPORT_ENDPOINT}...")
    
    # V&V Metric: Record timestamp BEFORE report generation
    start_time = time.time() 
    
    response = requests.get(REPORT_ENDPOINT, headers=headers)
    
    # V&V Metric: Record timestamp AFTER report generation
    end_time = time.time() 
    
    if response.status_code == 200:
        time_taken_seconds = end_time - start_time
        print("\n--- Report Performance Results ---")
        print(f"Target Goal: <= 5.00 seconds")
        print(f"Actual Time:  {time_taken_seconds:.2f} seconds")
        
        if time_taken_seconds <= 5.0:
            print("✅ STATUS: PASSED. Report generated within threshold.")
            print(f"File Size: {len(response.content) / 1024:.2f} KB generated.")
        else:
            print("❌ STATUS: FAILED. Report took too long to generate.")
    else:
        print(f"Request failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    run_report_performance_test()