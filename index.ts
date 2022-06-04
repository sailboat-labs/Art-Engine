import { buildSetup, startCreating } from "./src/main";

const express = require("express");
const cors = require("cors");

// create base express application
const app = express();

const artEngineRoute = require("./src/routes/art-engine");

// configure application middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 7210;
(async () => {
  // register routes
  app.use(artEngineRoute);

  app.listen(port, () => {
    console.log(`🚀 Application running on port ${port}`);
    
  });
})();
