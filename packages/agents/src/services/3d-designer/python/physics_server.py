import pybullet as p
import pybullet_data
import json
import sys
import os
from typing import Dict, List, Tuple, Optional

class PhysicsServer:
    def __init__(self, dataset_path: str):
        self.dataset_path = dataset_path
        self.client_id = p.connect(p.DIRECT)  # Headless mode
        p.setAdditionalSearchPath(pybullet_data.getDataPath())
        p.setGravity(0, 0, -9.81)
        self.load_ground_plane()
        print(json.dumps({"status": "ready"}))
        sys.stdout.flush()

    def load_ground_plane(self):
        """Load the ground plane for collision detection"""
        p.loadURDF("plane.urdf")

    def load_furniture(self, model_path: str, position: List[float], orientation: List[float]) -> int:
        """Load furniture model into PyBullet"""
        try:
            obj_id = p.loadURDF(model_path, position, orientation)
            return obj_id
        except p.error as e:
            print(json.dumps({"error": f"Failed to load furniture: {str(e)}"}))
            return -1

    def check_collisions(self, furniture_list: List[Dict]) -> List[Dict]:
        """Check for collisions between furniture items"""
        collisions = []
        for i in range(len(furniture_list)):
            for j in range(i + 1, len(furniture_list)):
                points = p.getContactPoints(furniture_list[i]["id"], furniture_list[j]["id"])
                if points:
                    collision = {
                        "object1": furniture_list[i]["type"],
                        "object2": furniture_list[j]["type"],
                        "position": points[0][5],  # Contact point on object 1
                        "normal": points[0][7],    # Normal from object 1 to object 2
                        "distance": points[0][8]    # Penetration depth
                    }
                    collisions.append(collision)
        return collisions

    def validate_placement(self, layout: Dict) -> Dict:
        """Validate furniture placement using physics simulation"""
        furniture_objects = []
        
        # Load all furniture into simulation
        for item in layout["furniture"]:
            position = [item["position"]["x"], item["position"]["y"], item["position"]["z"]]
            orientation = p.getQuaternionFromEuler([0, 0, item["rotation"]["y"]])
            
            obj_id = self.load_furniture(
                os.path.join(self.dataset_path, item["type"], "model.urdf"),
                position,
                orientation
            )
            
            if obj_id >= 0:
                furniture_objects.append({
                    "id": obj_id,
                    "type": item["type"]
                })

        # Run simulation steps to let objects settle
        for _ in range(100):
            p.stepSimulation()

        # Check for collisions
        collisions = self.check_collisions(furniture_objects)

        # Clean up
        for obj in furniture_objects:
            p.removeBody(obj["id"])

        return {
            "isValid": len(collisions) == 0,
            "collisions": collisions
        }

    def cleanup(self):
        """Cleanup PyBullet instance"""
        p.disconnect(self.client_id)

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Dataset path not provided"}))
        sys.exit(1)

    dataset_path = sys.argv[1]
    server = PhysicsServer(dataset_path)

    try:
        while True:
            try:
                line = input()
                data = json.loads(line)
                
                if data["command"] == "validate":
                    result = server.validate_placement(data["layout"])
                    print(json.dumps(result))
                    sys.stdout.flush()
                elif data["command"] == "exit":
                    break
                
            except EOFError:
                break
            except json.JSONDecodeError as e:
                print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
                sys.stdout.flush()
                
    finally:
        server.cleanup()

if __name__ == "__main__":
    main()