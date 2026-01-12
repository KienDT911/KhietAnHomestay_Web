from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo import ReplaceOne
from bson.objectid import ObjectId
from dotenv import load_dotenv
import os
import json
from datetime import datetime

# Custom JSON encoder to handle datetime and ObjectId
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for global access
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "supports_credentials": False
    }
})

# Initialize variables
client = None
db = None
rooms_collection = None
fallback_rooms = []
data_source = 'none'

# MongoDB Connection - Try Primary Source First

json_file_path = os.path.join(os.path.dirname(__file__), 'rooms_data.json')

def load_fallback_data():
    """Load rooms data from JSON file as fallback"""
    global fallback_rooms, data_source
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            fallback_rooms = json.load(file)
        data_source = 'fallback_json'
        return True
    except Exception as e:
        return False

def sync_mongodb_to_json():
    """Sync MongoDB data to local JSON file for backup"""
    global rooms_collection
    try:
        if rooms_collection is not None:
            rooms_from_db = list(rooms_collection.find())
            with open(json_file_path, 'w', encoding='utf-8') as file:
                json.dump(rooms_from_db, file, indent=4, ensure_ascii=False, cls=MongoJSONEncoder)
            return True
    except Exception as sync_error:
        pass
    return False

def connect_mongodb():
    """Attempt to connect to MongoDB"""
    global client, db, rooms_collection, data_source
    
    uri = os.getenv('MONGODB_URI')
    if not uri:
        return False
    
    try:
        client = MongoClient(
            uri, 
            server_api=ServerApi('1'),
            tls=True,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000
        )
        # Verify connection
        client.admin.command('ping')
        
        db_name = os.getenv('MONGODB_DB', 'khietanhomestay')
        collection_name = os.getenv('MONGODB_COLLECTION', 'rooms')
        
        db = client[db_name]
        rooms_collection = db[collection_name]
        data_source = 'mongodb'
        
        # Sync to JSON as backup
        sync_mongodb_to_json()
        return True
        
    except Exception as e:
        client = None
        db = None
        rooms_collection = None
        return False

# Try to connect to MongoDB, fall back to JSON if failed
if not connect_mongodb():
    load_fallback_data()

# ===== Helper Functions =====
def convert_room_for_api(room):
    """Convert MongoDB room document to API response format"""
    if room is None:
        return None
    
    # Convert _id to string for JSON serialization
    id_value = room.get('_id', '')
    if isinstance(id_value, ObjectId):
        id_str = str(id_value)
    else:
        id_str = str(id_value)
    
    # Map MongoDB field names to API field names
    api_room = {
        'room_id': id_str,
        'id': id_str,
        'name': room.get('name', ''),
        'price': room.get('price', 0),
        'capacity': room.get('persons', 0),
        'persons': room.get('persons', 0),
        'description': room.get('description', ''),
        'amenities': room.get('amenities', []),
        'bookedIntervals': room.get('bookedIntervals', []),
        'created_at': str(room.get('created_at', '')) if room.get('created_at') else None,
        'updated_at': str(room.get('updated_at', '')) if room.get('updated_at') else None
    }
    return api_room

def save_fallback_data():
    """Save fallback data to JSON file"""
    try:
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(fallback_rooms, f, indent=4, ensure_ascii=False, cls=MongoJSONEncoder)
        return True
    except Exception as e:
        return False

# ===== Root & Info Endpoints =====

@app.route('/', methods=['GET'])
def root():
    """Root endpoint - API info"""
    return jsonify({
        'success': True,
        'message': 'KhietAn Homestay API is running',
        'version': '1.0.0',
        'data_source': data_source,
        'endpoints': {
            'health': '/backend/health',
            'rooms': '/backend/api/rooms',
            'admin_rooms': '/backend/api/admin/rooms'
        }
    }), 200

# ===== Public Room API Endpoints (Read-Only) =====

@app.route('/backend/api/rooms', methods=['GET'])
def get_public_rooms():
    """Fetch all rooms for public display"""
    try:
        if rooms_collection is None:
            # Use fallback JSON data
            api_rooms = [convert_room_for_api(room) for room in fallback_rooms]
            return jsonify({
                'success': True,
                'data': api_rooms,
                'count': len(api_rooms),
                'source': 'fallback'
            }), 200
        
        rooms = list(rooms_collection.find())
        api_rooms = [convert_room_for_api(room) for room in rooms]
        
        return jsonify({
            'success': True,
            'data': api_rooms,
            'count': len(api_rooms),
            'source': 'mongodb'
        }), 200
    except Exception as e:
        # If MongoDB fails during request, try fallback
        if fallback_rooms:
            api_rooms = [convert_room_for_api(room) for room in fallback_rooms]
            return jsonify({
                'success': True,
                'data': api_rooms,
                'count': len(api_rooms),
                'source': 'fallback_error_recovery'
            }), 200
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/rooms/<room_id>', methods=['GET'])
def get_public_room(room_id):
    """Fetch a specific room by ID for public display"""
    try:
        room = None
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                except:
                    pass
        
        if not room:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        api_room = convert_room_for_api(room)
        return jsonify({
            'success': True,
            'data': api_room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/rooms/available', methods=['GET'])
def get_available_rooms():
    """Fetch only available rooms"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        available_rooms = []
        
        if rooms_collection is None:
            rooms = fallback_rooms
        else:
            rooms = list(rooms_collection.find())
        
        for room in rooms:
            is_available = True
            booked_intervals = room.get('bookedIntervals', [])
            
            for interval in booked_intervals:
                check_in = interval.get('checkIn', '')
                check_out = interval.get('checkOut', '')
                if check_in <= today < check_out:
                    is_available = False
                    break
            
            if is_available:
                api_room = convert_room_for_api(room)
                api_room['available'] = True
                available_rooms.append(api_room)
        
        return jsonify({
            'success': True,
            'data': available_rooms,
            'count': len(available_rooms)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/rooms/<room_id>/status', methods=['GET'])
def get_room_status(room_id):
    """Get availability status for a specific room"""
    try:
        room = None
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                except:
                    pass
        
        if not room:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        is_available = True
        current_booking = None
        
        for interval in room.get('bookedIntervals', []):
            check_in = interval.get('checkIn', '')
            check_out = interval.get('checkOut', '')
            if check_in <= today < check_out:
                is_available = False
                current_booking = {
                    'checkIn': check_in,
                    'checkOut': check_out
                }
                break
        
        return jsonify({
            'success': True,
            'data': {
                'room_id': room_id,
                'available': is_available,
                'status': 'available' if is_available else 'booked',
                'currentBooking': current_booking
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ===== Admin Room API Endpoints =====

@app.route('/backend/api/admin/rooms', methods=['GET'])
def get_all_rooms():
    """Fetch all rooms from MongoDB or fallback JSON"""
    try:
        if rooms_collection is None:
            api_rooms = [convert_room_for_api(room) for room in fallback_rooms]
            return jsonify({
                'success': True,
                'data': api_rooms,
                'count': len(api_rooms),
                'source': 'fallback'
            }), 200
        
        rooms = list(rooms_collection.find())
        api_rooms = [convert_room_for_api(room) for room in rooms]
        
        return jsonify({
            'success': True,
            'data': api_rooms,
            'count': len(api_rooms),
            'source': 'mongodb'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms/<room_id>', methods=['GET'])
def get_room(room_id):
    """Fetch a specific room by ID"""
    try:
        room = None
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                except:
                    pass
        
        if not room:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        api_room = convert_room_for_api(room)
        return jsonify({
            'success': True,
            'data': api_room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms', methods=['POST'])
def add_room():
    """Add a new room to MongoDB using upsert with custom ID"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'price', 'capacity', 'description', 'amenities']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Get custom ID (4 digit room ID like 0101, 0201)
        custom_id = data.get('custom_id')
        if custom_id:
            if not custom_id.isdigit() or len(custom_id) != 4:
                return jsonify({
                    'success': False,
                    'error': 'Room ID must be exactly 4 digits (e.g., 0101, 0201)'
                }), 400
        
        # Prepare room document
        new_room = {
            'name': data.get('name'),
            'price': float(data.get('price')),
            'persons': int(data.get('capacity')),
            'description': data.get('description'),
            'amenities': data.get('amenities', []),
            'bookedIntervals': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        if rooms_collection is None:
            # Add to fallback list
            if custom_id:
                new_room['_id'] = custom_id
            else:
                numeric_ids = [int(r.get('_id', 0)) for r in fallback_rooms if str(r.get('_id', '0')).isdigit()]
                new_id = str(max(numeric_ids + [0]) + 1).zfill(4)
                new_room['_id'] = new_id
            
            # Check for duplicate
            existing = next((r for r in fallback_rooms if r.get('_id') == new_room['_id']), None)
            if existing:
                return jsonify({
                    'success': False,
                    'error': f'Room with ID {new_room["_id"]} already exists'
                }), 400
            
            fallback_rooms.append(new_room)
            save_fallback_data()
            api_room = convert_room_for_api(new_room.copy())
        else:
            # MongoDB mode
            if custom_id:
                new_room['_id'] = custom_id
                existing = rooms_collection.find_one({'_id': custom_id})
                if existing:
                    return jsonify({
                        'success': False,
                        'error': f'Room with ID {custom_id} already exists'
                    }), 400
            else:
                new_room['_id'] = ObjectId()
            
            operations = [ReplaceOne({'_id': new_room['_id']}, new_room, upsert=True)]
            result = rooms_collection.bulk_write(operations)
            
            # Sync to JSON backup
            sync_mongodb_to_json()
            api_room = convert_room_for_api(new_room.copy())
        
        return jsonify({
            'success': True,
            'message': 'Room added successfully',
            'data': api_room
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms/<room_id>', methods=['PUT'])
def update_room(room_id):
    """Update a room in MongoDB using upsert"""
    try:
        data = request.get_json()
        
        if rooms_collection is None:
            # Update in fallback data
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
            if not room:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            if 'name' in data:
                room['name'] = data['name']
            if 'price' in data:
                room['price'] = float(data['price'])
            if 'capacity' in data:
                room['persons'] = int(data['capacity'])
            if 'description' in data:
                room['description'] = data['description']
            if 'amenities' in data:
                room['amenities'] = data['amenities']
            room['updated_at'] = datetime.utcnow().isoformat()
            
            save_fallback_data()
            api_room = convert_room_for_api(room.copy())
        else:
            # Find existing room
            existing_room = rooms_collection.find_one({'_id': room_id})
            if not existing_room:
                try:
                    obj_id = ObjectId(room_id)
                    existing_room = rooms_collection.find_one({'_id': obj_id})
                    if existing_room:
                        room_id = obj_id
                except:
                    pass
            
            if not existing_room:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            updated_room = existing_room.copy()
            updated_room['_id'] = room_id
            
            if 'name' in data:
                updated_room['name'] = data['name']
            if 'price' in data:
                updated_room['price'] = float(data['price'])
            if 'capacity' in data:
                updated_room['persons'] = int(data['capacity'])
            if 'persons' in data:
                updated_room['persons'] = int(data['persons'])
            if 'description' in data:
                updated_room['description'] = data['description']
            if 'amenities' in data:
                updated_room['amenities'] = data['amenities']
            updated_room['updated_at'] = datetime.utcnow()
            
            operations = [ReplaceOne({'_id': room_id}, updated_room, upsert=True)]
            result = rooms_collection.bulk_write(operations)
            
            sync_mongodb_to_json()
            api_room = convert_room_for_api(updated_room.copy())
        
        return jsonify({
            'success': True,
            'message': 'Room updated successfully',
            'data': api_room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms/<room_id>', methods=['DELETE'])
def delete_room(room_id):
    """Delete a room from MongoDB or fallback list"""
    try:
        if rooms_collection is None:
            global fallback_rooms
            original_count = len(fallback_rooms)
            fallback_rooms = [r for r in fallback_rooms if r.get('_id') != room_id]
            
            if len(fallback_rooms) == original_count:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            save_fallback_data()
        else:
            result = rooms_collection.delete_one({'_id': room_id})
            
            if result.deleted_count == 0:
                try:
                    obj_id = ObjectId(room_id)
                    result = rooms_collection.delete_one({'_id': obj_id})
                except:
                    pass
            
            if result.deleted_count == 0:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            sync_mongodb_to_json()
        
        return jsonify({
            'success': True,
            'message': 'Room deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ===== Booking API Endpoints =====

@app.route('/backend/api/admin/rooms/<room_id>/book', methods=['POST'])
def book_room(room_id):
    """Create a booking for a room"""
    try:
        data = request.json
        
        if not data.get('checkIn') or not data.get('checkOut') or not data.get('guestName'):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: checkIn, checkOut, guestName'
            }), 400
        
        check_in = data['checkIn']
        check_out = data['checkOut']
        guest_name = data['guestName']
        
        def has_duplicate_booking(existing_intervals):
            if not existing_intervals:
                return False
            for interval in existing_intervals:
                if (interval.get('checkIn') == check_in and 
                    interval.get('checkOut') == check_out and
                    interval.get('guestName') == guest_name):
                    return True
                existing_start = interval.get('checkIn', '')
                existing_end = interval.get('checkOut', '')
                if existing_start and existing_end:
                    if check_in < existing_end and check_out > existing_start:
                        return True
            return False
        
        new_interval = {
            'checkIn': check_in,
            'checkOut': check_out,
            'guestName': guest_name,
            'guestPhone': data.get('guestPhone', ''),
            'guestEmail': data.get('guestEmail', ''),
            'notes': data.get('notes', ''),
            'createdAt': datetime.now().isoformat()
        }
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
            if not room:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            if has_duplicate_booking(room.get('bookedIntervals', [])):
                return jsonify({
                    'success': False,
                    'error': 'Booking already exists or dates overlap with existing booking'
                }), 409
            
            if 'bookedIntervals' not in room:
                room['bookedIntervals'] = []
            room['bookedIntervals'].append(new_interval)
            room['updated_at'] = datetime.now().isoformat()
            
            save_fallback_data()
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                    room_id_filter = {'_id': obj_id}
                except:
                    return jsonify({
                        'success': False,
                        'error': 'Room not found'
                    }), 404
            else:
                room_id_filter = {'_id': room_id}
            
            if has_duplicate_booking(room.get('bookedIntervals', [])):
                return jsonify({
                    'success': False,
                    'error': 'Booking already exists or dates overlap with existing booking'
                }), 409
            
            result = rooms_collection.update_one(
                room_id_filter,
                {
                    '$push': {'bookedIntervals': new_interval},
                    '$set': {'updated_at': datetime.now()}
                }
            )
            
            if result.modified_count == 0:
                return jsonify({
                    'success': False,
                    'error': 'Failed to update room'
                }), 500
            
            sync_mongodb_to_json()
        
        return jsonify({
            'success': True,
            'message': 'Booking created successfully',
            'data': new_interval
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms/<room_id>/unbook', methods=['POST'])
def unbook_room(room_id):
    """Cancel a booking for a room"""
    try:
        data = request.json
        
        if not data.get('checkIn') or not data.get('checkOut'):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: checkIn, checkOut'
            }), 400
        
        check_in = data['checkIn']
        check_out = data['checkOut']
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
            if not room:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            if 'bookedIntervals' in room:
                original_length = len(room['bookedIntervals'])
                room['bookedIntervals'] = [
                    interval for interval in room['bookedIntervals']
                    if not (interval['checkIn'] == check_in and interval['checkOut'] == check_out)
                ]
                
                if len(room['bookedIntervals']) == original_length:
                    return jsonify({
                        'success': False,
                        'error': 'Booking not found'
                    }), 404
                
                room['updated_at'] = datetime.now().isoformat()
                save_fallback_data()
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                    room_id_filter = {'_id': obj_id}
                except:
                    return jsonify({
                        'success': False,
                        'error': 'Room not found'
                    }), 404
            else:
                room_id_filter = {'_id': room_id}
            
            result = rooms_collection.update_one(
                room_id_filter,
                {
                    '$pull': {
                        'bookedIntervals': {
                            'checkIn': check_in,
                            'checkOut': check_out
                        }
                    },
                    '$set': {'updated_at': datetime.now()}
                }
            )
            
            if result.modified_count == 0:
                return jsonify({
                    'success': False,
                    'error': 'Booking not found or failed to update'
                }), 404
            
            sync_mongodb_to_json()
        
        return jsonify({
            'success': True,
            'message': 'Booking cancelled successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/backend/api/admin/rooms/<room_id>/update-booking', methods=['PUT'])
def update_booking(room_id):
    """Update booking information for a room"""
    try:
        data = request.json
        
        if not data.get('checkIn') or not data.get('checkOut') or not data.get('guestName'):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: checkIn, checkOut, guestName'
            }), 400
        
        check_in = data['checkIn']
        check_out = data['checkOut']
        guest_name = data['guestName']
        guest_phone = data.get('guestPhone', '')
        guest_email = data.get('guestEmail', '')
        notes = data.get('notes', '')
        
        if rooms_collection is None:
            room = next((r for r in fallback_rooms if r.get('_id') == room_id), None)
            if not room:
                return jsonify({
                    'success': False,
                    'error': 'Room not found'
                }), 404
            
            if 'bookedIntervals' in room:
                for interval in room['bookedIntervals']:
                    if interval['checkIn'] == check_in and interval['checkOut'] == check_out:
                        interval['guestName'] = guest_name
                        interval['guestPhone'] = guest_phone
                        interval['guestEmail'] = guest_email
                        interval['notes'] = notes
                        interval['updatedAt'] = datetime.now().isoformat()
                        break
                else:
                    return jsonify({
                        'success': False,
                        'error': 'Booking not found'
                    }), 404
                
                room['updated_at'] = datetime.now().isoformat()
                save_fallback_data()
        else:
            room = rooms_collection.find_one({'_id': room_id})
            if not room:
                try:
                    obj_id = ObjectId(room_id)
                    room = rooms_collection.find_one({'_id': obj_id})
                    room_id_filter = {'_id': obj_id}
                except:
                    return jsonify({
                        'success': False,
                        'error': 'Room not found'
                    }), 404
            else:
                room_id_filter = {'_id': room_id}
            
            result = rooms_collection.update_one(
                {
                    **room_id_filter,
                    'bookedIntervals.checkIn': check_in,
                    'bookedIntervals.checkOut': check_out
                },
                {
                    '$set': {
                        'bookedIntervals.$.guestName': guest_name,
                        'bookedIntervals.$.guestPhone': guest_phone,
                        'bookedIntervals.$.guestEmail': guest_email,
                        'bookedIntervals.$.notes': notes,
                        'bookedIntervals.$.updatedAt': datetime.now(),
                        'updated_at': datetime.now()
                    }
                }
            )
            
            if result.matched_count == 0:
                return jsonify({
                    'success': False,
                    'error': 'Booking not found'
                }), 404
            
            sync_mongodb_to_json()
        
        return jsonify({
            'success': True,
            'message': 'Booking updated successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ===== Health Check & Reconnect =====

@app.route('/backend/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        if client is not None:
            client.admin.command('ping')
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'source': 'mongodb'
            }), 200
        else:
            return jsonify({
                'status': 'healthy',
                'database': 'disconnected',
                'source': 'fallback_json',
                'rooms_loaded': len(fallback_rooms)
            }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/backend/reconnect', methods=['POST'])
def reconnect_database():
    """Attempt to reconnect to MongoDB"""
    global client, db, rooms_collection, data_source
    
    if connect_mongodb():
        return jsonify({
            'success': True,
            'message': 'Successfully reconnected to MongoDB',
            'source': 'mongodb'
        }), 200
    else:
        return jsonify({
            'success': False,
            'message': 'Failed to reconnect to MongoDB, using fallback data',
            'source': data_source
        }), 200

@app.route('/backend/sync', methods=['POST'])
def sync_data():
    """Manually sync MongoDB data to JSON backup"""
    if rooms_collection is not None:
        if sync_mongodb_to_json():
            return jsonify({
                'success': True,
                'message': 'Data synced to JSON backup'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to sync data'
            }), 500
    else:
        return jsonify({
            'success': False,
            'message': 'MongoDB not connected, nothing to sync'
        }), 400

# ===== Error Handlers =====

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

# For Vercel deployment - expose the app
app = app

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
