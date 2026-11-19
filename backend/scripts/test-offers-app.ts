import express from "express";
import offersRouter from "../src/modules/offers";
const app = express();
app.use(express.json());
app.use("/api/v1/offers", offersRouter);
app.listen(5099, () => console.log("test route on 5099"));
