# University of Tartu Institute of Genomics Interview Task 2022  
* JavaScript, Node.js and Express  
* Pug  
* node-postgres  
It was my first time doing most of this myself, so it feels a bit too hacky/eclectic for my liking.  

Time spent: 20h.  

## Installation  
Clone the project and open it in a terminal that supports `node` and `npm` commands.  
`git clone`  
Change directory to `GI-TESTTASK-WEBAPP`  
`cd .\GI-TESTTASK-WEBAPP\`  
Install dependencies  
`npm install`  
Make a copy of the file `GI-TESTTASK-WEBAPP\default_template.json` with the name `GI-TESTTASK-WEBAPP\default.json`  
Edit the file and insert your PostgreSQL access configurations.  
Create the database by running `create_gipeople.js` (the name of the database is GI_PEOPLE)   
`node .\create_gipeople.js`  
It can later be deleted by running `drop_gipeople.js`  
`node .\drop_gipeople.js`  
Start the server by running `app.js`  
`node .\app.js`  
Access the server on your localhost (for me it was http://localhost:3000/).  

### Prerequisites to Installation  
What I used is in parentheses.  
* Operating system (x86-64 Windows)  
* A terminal programme (Windows PowerShell (with admin access))  
* Node.js (Node Version Manager for Windows, 16.16.0)  
* Node Package Manager (8.11.0)  
* PostgreSQL (14.4 Windows x86-64)  
