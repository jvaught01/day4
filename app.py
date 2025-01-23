import flask
import os
import requests
import json
import dotenv
from flask_cors import CORS
from typing import Dict, Any
from flask import jsonify, Response
import boto3
from botocore.exceptions import ClientError

dotenv.load_dotenv()

app = flask.Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, resources={
    r"/api/*": {
        "origins": [os.getenv("CUSTOM_DOMAIN")],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True,
        "max_age": 300
    }
})


SERP_API_KEY = os.getenv("SERP_API_KEY")
SERP_API_URL = "https://serpapi.com/search/"


if not SERP_API_KEY:
    raise ValueError("SERP_API_KEY environment variable is not set")


S3_BUCKET = "sports-showtime-votes"  
S3_KEY = "votes.json"


s3 = boto3.client('s3')

@app.route('/')
def index():
    api_domain = os.getenv('CUSTOM_API_DOMAIN')
    return flask.render_template('landing.html', api_domain=api_domain)

@app.route('/api/gametimes')
def gametimes() -> Response:
    try:
        params: Dict[str, Any] = {
            "engine": "google",
            "q": "nfl schedule",
            "api_key": SERP_API_KEY,
        }
        
        # Add timeout to prevent hanging
        response = requests.get(SERP_API_URL, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        sports_results = data.get("sports_results", {})
        games = sports_results.get("games", [])
        
        return jsonify({
            "message": "Games found." if games else "No games found.",
            "games": games,
            "count": len(games)
        }), 200
        
    except requests.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.RequestException as e:
        return jsonify({"error": f"API request failed: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/votes', methods=['GET'])
def get_votes() -> Response:
    try:
        response = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        votes = json.loads(response['Body'].read().decode('utf-8'))
        return jsonify(votes), 200
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            default_votes = {
                "Chiefs": 0,
                "Bills": 0,
                "Eagles": 0,
                "Commanders": 0
            }
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=S3_KEY,
                Body=json.dumps(default_votes)
            )
            return jsonify(default_votes), 200
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/votes', methods=['POST'])
def cast_vote() -> Response:
    try:
        team = flask.request.json.get('team')
        if not team or team not in ["Chiefs", "Bills", "Eagles", "Commanders"]:
            return jsonify({"error": "Invalid team"}), 400

        try:
            response = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
            votes = json.loads(response['Body'].read().decode('utf-8'))
        except ClientError:
            votes = {
                "Chiefs": 0,
                "Bills": 0,
                "Eagles": 0,
                "Commanders": 0
            }

        votes[team] += 1

        s3.put_object(
            Bucket=S3_BUCKET,
            Key=S3_KEY,
            Body=json.dumps(votes)
        )

        return jsonify(votes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/votes', methods=['OPTIONS'])
def votes_options():
    response = flask.make_response()
    response.headers.add('Access-Control-Allow-Origin', os.getenv("CUSTOM_DOMAIN"))
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)