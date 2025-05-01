#!/usr/bin/env python3
"""
Script to combine outdated Python package reports from different requirements files
and create a structured report similar to the Node.js one.
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any

def parse_version(version: str) -> List[int]:
    """Parse a version string into a list of integers for comparison."""
    return [int(x) for x in version.split('.')]

def get_update_type(current: str, latest: str) -> str:
    """Determine if an update is major, minor, or patch based on semver."""
    try:
        current_parts = parse_version(current)
        latest_parts = parse_version(latest)
        
        if latest_parts[0] > current_parts[0]:
            return "major"
        elif latest_parts[1] > current_parts[1]:
            return "minor"
        elif len(latest_parts) > 2 and len(current_parts) > 2 and latest_parts[2] > current_parts[2]:
            return "patch"
        return "unknown"
    except (ValueError, IndexError):
        return "unknown"

def main():
    # Initialize the report structure
    report = {
        "timestamp": datetime.now().isoformat(),
        "packages": [],
        "summary": {
            "total": 0,
            "major": 0,
            "minor": 0,
            "patch": 0
        }
    }
    
    # Track packages we've already added to avoid duplicates
    processed_packages = set()
    
    # Files to process
    files = [
        "packages/ml/python-outdated.json",
        "rag-outdated.json"
    ]
    
    # Process each outdated packages file
    for file_path in files:
        if not os.path.exists(file_path):
            print(f"Warning: File {file_path} does not exist, skipping.")
            continue
            
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                
            for package in data:
                name = package.get("name")
                if name in processed_packages:
                    continue
                    
                current = package.get("version")
                latest = package.get("latest_version")
                
                if not current or not latest:
                    continue
                    
                update_type = get_update_type(current, latest)
                
                # Add to packages list
                report["packages"].append({
                    "name": name,
                    "current": current,
                    "latest": latest,
                    "updateType": update_type,
                    "packageType": "python",
                    "source": os.path.basename(file_path)
                })
                
                # Update summary counters
                report["summary"]["total"] += 1
                if update_type in report["summary"]:
                    report["summary"][update_type] += 1
                    
                # Mark as processed
                processed_packages.add(name)
                
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error processing {file_path}: {e}")
    
    # Write the combined report
    with open("python-outdated-report.json", "w") as f:
        json.dump(report, f, indent=2)
        
    print(f"Successfully wrote Python outdated packages report with {report['summary']['total']} packages")

if __name__ == "__main__":
    main()