import offers from "../src/modules/offers";
const stack = offers.stack || offers?._router?.stack || [];
console.log("items", stack.length);
for (const layer of stack) {
  const path = layer.route?.path || layer.regexp?.source;
  console.log(layer.name, path);
}
process.exit(0);
