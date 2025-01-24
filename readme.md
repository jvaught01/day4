# Sports API Management System With Landing Page and realtime polling

## Overview
A containerized API management system for sports data queries, featuring a custom domain and landing page. Built with AWS ECS (Fargate), API Gateway, Load Balancing, DynamoDB, and integrated with external sports data providers. 


## Architecture

![Architecture Diagram](https://raw.githubusercontent.com/jvaught01/day4/refs/heads/master/architecture-diagram.svg)

The system consists of:

1. Route 53: DNS routing to ALB and API Gateway
2. ALB: Load balancing for Fargate containers
3. API Gateway: Manages /gametimes and /votes endpoints
4. ECS/Fargate: Runs containerized Flask application
5. S3: Stores voting data as JSON
6. External Sports API: Provides game schedule data

## Prerequisites
- AWS Account with console access
- Sports API key from sportsdata.io
- Docker installed locally
- Domain name (for custom domain setup)
- A willingness to debug if you run into CORS erros 😂 

## Setup Instructions

### 1. Clone the Repository
```bash
git clone MY REPO
cd day4
```

### 2. Create ECR Repository
```bash
aws login 
aws ecr create-repository --repository-name sports-api --region us-east-1
```

### 3. Build and Push Docker Image
```bash

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag the image
docker build --platform linux/amd64 -t sports-api .
docker tag sports-api:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sports-api:sports-api-latest

# Push to ECR
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sports-api:sports-api-latest
```

### 4. ACM Certificate Setup

#### Certificates
1. Go to AWS Certificate Manager
2. Click "Request certificate" → "Request a public certificate"
3. Add domain names:
   - `domain.com`
   - `api.domain.com`
4. Choose "DNS validation"
5. Click "Request"
6. Create CNAME records in Route 53:
   - Click "Create records in Route 53"
   - Select all records
   - Click "Create records"
7. Wait for validation (5-15 minutes)

### 5. Set Up ECS Cluster with Fargate

#### Create ECS Cluster
1. Navigate to ECS Console → Clusters → Create Cluster
2. Configure cluster:
   - Name: sports-api-cluster
   - Infrastructure: Fargate
3. Click "Create Cluster"

#### Create Task Definition
1. Go to Task Definitions → Create New Task Definition
2. Configure basic settings:
   - Name: sports-api-task
   - Infrastructure: Fargate
3. Add container configuration:
   - Container name: sports-api-container
   - Image URI: `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sports-api:sports-api-latest`
   - Port mappings:
     - Container port: 8080
     - Protocol: TCP
     - Port name: Leave blank
     - App protocol: HTTP
4. Add environment variables:
   - Key: SERP_API_KEY
   - Value: `SERP API KEY`
   - Key: CUSTOM_DOMAIN
   - Value: `domain.com`
   - Key: CUSTOM_API_DOMAIN
   - Value: `api.domain.com`
5. Click "Create task definition"

#### Create Service with ALB
1. Go to Clusters → Select Cluster → Service → Create
2. Configure service settings:
   - Capacity provider: Fargate
   - Task Definition: sports-api-task
   - Service name: sports-api-service
   - Desired tasks: 2
3. Configure networking:
   - Create new security group
   - Type: All TCP
   - Source: Anywhere
4. Configure load balancing:
   - Type: Application Load Balancer
   - Create new ALB:
     - Name: sports-api-alb
     - Listener(**MUST COMPLETE CERTIFICATE STEPS**): 
       - Port: 443
       - Protocol: HTTPS
       - Certificate: Choose your custom domain
     - Target group health check path: "/" (We'll use the landing page as the health check path rather than the api itself)
5. Click "Create service"

#### Verify ALB Setup
1. Wait for service deployment (5-10 minutes)
2. Note the ALB DNS name: `sports-api-alb-<AWS_ACCOUNT_ID>.us-east-1.elb.amazonaws.com`
3. Test the endpoint: `http://sports-api-alb-<AWS_ACCOUNT_ID>.us-east-1.elb.amazonaws.com/`

### 6. API Gateway Setup 
1. Navigate to API Gateway in AWS Console
2. Click "Create API" and select "REST API"
3. Configure the API:
   - API name: "sports-api"
   - Endpoint Type: Regional
4. Create resources:
   - Click "Create Resource"
   - Resource Path: api
   - Create another Resource within your "api" resource
   - Resource Path: gametimes
   - Click "Create Method"
     - Method Type: GET
     - Inegration Type: HTTP
     - HTTP Method: GET
     - endpoint URL: `http://sports-api-alb-<AWS_ACCOUNT_ID>.us-east-1.elb.amazonaws.com/api/gametimes`
  - Select "Enable CORS"
  - Access-Control-Allow-Methods: GET
   - Create another Resource within your "api" resource
   - Resource Path: votes
   - Click "Create Method"
     - Method Type: GET
     - Inegration Type: HTTP
     - HTTP Method: GET
     - Endpoint URL: `http://sports-api-alb-<AWS_ACCOUNT_ID>.us-east-1.elb.amazonaws.com/api/votes`
   - Create another Method
     - Method Type: POST
     - Integration Type: HTTP
     - HTTP Method: POST
     - Endpoint URL:`http://sports-api-alb-<AWS_ACCOUNT_ID>.us-east-1.elb.amazonaws.com/api/votes`
  - Select "Enable CORS"
  - Access-Control-Allow-Methods: GET, POST
5. Deploy API:
   - Click "Deploy API"
   - Stage name: "Prod"

### 7. Custom Domain Configuration
1. In API Gateway console, click "Custom domain names"
2. Click "Create custom domain name"
3. Configure domain:
   - Domain name: `api.yourdomain.com`
   - ACM certificate: Select your certificate
   - Minimum TLS version: TLS 1.2
4. Add API mapping:
   - Click "Configure API mappings"
   - Click "Add new mapping"
   - API: Select your API
   - Stage: Prod

### 8. DNS Configuration
1. Navigate to Route 53
2. Select your hosted zone
3. Create record:
   - Record name:  `yourdomain.com`
   - Record type: A
   - Alias: YES
   - Route Traffic to: Alias to Application and Classic Load Balancer
   - Region: US-EAST-1
   - Select Your ALB Endpoint
4. Create record:
   - Record name:  `api.yourdomain.com`
   - Record type: A
   - Alias: YES
   - Route Traffic to: Alias to API Gateway API
   - Region: US-EAST-1
   - Select Your API Gateway Endpoint 

## Endpoints
- Health Check: `https://yourdomain.com/`
- API Endpoint: `https://api.yourdomain.com/api/gametimes` & `https://api.yourdomain.com/api/votes`

## Environment Variables
- `SPORTS_API_KEY`: Your sportsdata.io API key

## Troubleshooting
1. API Gateway 502 errors:
   - Verify ALB health checks are passing
   - Check ECS task logs
   - Verify security group allows inbound traffic

2. Custom domain issues:
   - Check DNS propagation
   - Verify certificate status in ACM
   - Confirm API mapping configuration

