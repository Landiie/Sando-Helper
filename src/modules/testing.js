const obj = {
  win1: { id: "pog" },
  win2: { id: "wa" },
  win3: {},
  win4: { id: null },
  win5: { id: 10 },
  win6: { id: "who", important: "data" },
  win7: { id: "who", important: "data" },
  win8: { id: "who", important: "data" },
  win9: { id: "who", important: "data" },
};

console.log(searchObjofObjs(obj, "id", "who"));

function searchObjofObjs(targetObj, key, value) {
  const matched = [];
  const objs = Object.values(targetObj);
  objs.forEach(obj => {
    if (obj[key] === value) matched.push(obj);
  });
  return matched;
}
