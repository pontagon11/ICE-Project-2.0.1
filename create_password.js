const bcrypt = require("bcrypt");

const users = [
  { username: "admin", password: "1234" },
  { username: "staff", password: "1234" }
];

(async () => {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    console.log(u.username, hash);
  }
})();