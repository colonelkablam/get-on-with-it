import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "get-on-with-it",
  password: "letmein",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let items = [
  { id: 1, title: "Not connected to the db :(" }, // default list
];

async function getItems() {
  const result = await db.query("SELECT * FROM items;");
  return result.rows;
}

async function getCompletedItems() {
  const result = await db.query("SELECT * FROM items WHERE completed = TRUE;");
  return result.rows;
}

async function addItem(title) {
  const result = await db.query("INSERT INTO items (title) VALUES ($1) RETURNING *;",
    [title]
  );
  return result.rows;
}

async function editItem(id, newTitle) {
  const result = await db.query("UPDATE items SET title = $1 WHERE id = $2;",
    [newTitle, id]
  );
  return result.rows;
}

app.get("/", async (req, res) => {
  items = await getItems();
  const completedItems = await getCompletedItems();
  const error = req.query.error; // Get error from query params

  res.render("index.ejs", {
    listTitle: "Today",
    listItems: items,
    completedListItems: completedItems,
    error: error,
  });
});

app.post("/add", async (req, res) => {
  const itemText = req.body.newItemText;

  if (itemText) {
    const result = await addItem(itemText);
    res.redirect("/");
  } else {
    res.redirect("/?error=Please enter some text");
  }

});

app.post("/edit", async (req, res) => {
  const updatedItemTitle = req.body.updatedItemTitle;
  const itemId = req.body.updatedItemId;
  console.log(itemId, updatedItemTitle);
  await editItem(itemId, updatedItemTitle);
  res.redirect("/");
  
});

app.post("/check-off", async (req, res) => {

});


app.post("/delete", async (req, res) => {
  
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
