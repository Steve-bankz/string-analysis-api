# String Analysis API

A lightweight **Node.js + Express** REST API that analyzes and stores string data without relying on an external database.  
Data is persisted locally using a simple **JSON-based store (LowDB)**, and each string is uniquely identified using a **SHA256 hash**.

## Features

- Analyze a string and compute:
  - Length
  - Palindrome check
  - Unique character count
  - Word count
  - Character frequency map
  - SHA256 hash for uniqueness
- Prevents duplicate entries
- Fetch individual or multiple analyses (with query filters)
- Natural language query endpoint (parse human-readable queries)
- Delete analyzed strings
- Persistent local JSON data storage (`db.json`)
- RESTful error handling (400 / 404 / 409 / 422)

## Tech Stack

- **Node.js**
- **Express.js**
- **LowDB** (local JSON data persistence)
- **crypto** (for SHA256 hashing)
- **dotenv** (for environment variables)

## Dependencies

Package and Description
express | Web framework for Node.js |
lowdb | Lightweight JSON-based database |
dotenv | Environment variable loader |

## Installation

## 1 Clone the repository

git clone https://github.com/Steve-bankz/string-analysis-api.git
cd string-analysis-api

## 2 Install Dependencies

npm install

# Environment Variables

Create a .env file in the project root:

PORT=3000

# Run Locally

Start the development server:
run manually with Node:
node server.js

Once started, the API will be available at:

http://localhost:3000

# API Documentation

## POST /strings

Analyzes and stores a string.

Request Body
{
"value": "madam"
}

Responses

201 Created

{
"id": "a1b2c3...",
"value": "madam",
"properties": {
"length": 5,
"is_palindrome": true,
"unique_characters": 3,
"word_count": 1,
"character_frequency_map": { "m": 2, "a": 2, "d": 1 },
"sha256": "..."
},
"createdAt": "2025-10-20T12:00:00.000Z"
}

400: Missing or invalid "value"

409: String already exists

422: "value" not a string

## GET /strings/:value

Fetch a single analyzed string by its value.

Example
GET /strings/hell world

Responses

200 OK: Returns the analyzed record.

404: String not found.

## GET /strings?is_palindrome=true&min_length=5

Fetch multiple analyses using query parameters.

Response
{
"data": [ { ...matching records... } ],
"filters_applied": {
"is_palindrome": true,
"min_length": 5
}
}

Errors

400 Bad Request: Invalid query parameter or type

## GET /analyze/filter-by-natural-language?

Perform a natural language query.

Example
GET /strings/filter-by-natural-language?query=find all strings that contain the letter e

Response
{
"data": [ { ...matching records... } ],
"count": 3,
"interpreted_query": {
"original": "find all strings that contain the letter e",
"parsed_filters": {
"contains_character": "e"
}
}
}

Errors

400: Unable to parse natural language query

422: Parsed successfully but filters conflict

# DELETE /strings/:value

Delete a string analysis by its value.

Example
DELETE /strings/i am here

Responses

204 No Content: Successfully deleted.

404 Not Found: String does not exist.

# Data Storage

Data is stored in a local JSON file db.json in this format:

{
"analyses": [
{
"id": "sha256-hash",
"value": "example",
"properties": {
"length": 7,
"is_palindrome": false,
"unique_characters": 6,
"word_count": 1,
"character_frequency_map": { ... },
"sha256": "sha256-hash"
},
"createdAt": "2025-10-20T11:00:00.000Z"
}
]
}

# Deployment

You can easily deploy this project on Railway, Render, or Vercel.

For Railway:

Push your project to GitHub.

Create a new service from your repo.

Add environment variable PORT.

Add a persistent volume to store db.json.

Deploy

# Author

Steve Bankz
Backend Developer | API Architect

# License

This project is open-source under the MIT License
.
