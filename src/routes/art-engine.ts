import { generateTokens } from "./../generate_tokens";
import { buildSetup, startCreating } from "../main";

const { Router } = require("express");

const router = Router();

router.post("/generate", async (req, res) => {
  const { address, collection,layersOrder } = req.body;
  if (!address || !collection || !layersOrder)
    return res.status(403).send("Address and/or collection not given");

  res.send("generation started");
  buildSetup({ address, collection });
  startCreating({ address, collection,layersOrder });
  // generateTokens({ address, collection });
});

module.exports = router;
