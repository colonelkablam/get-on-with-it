import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import moment from "moment";

const app = express();
const port = 3000;
const date = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

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

async function getItems(date) {
  const result = await db.query("SELECT * FROM items WHERE completed = FALSE AND date = $1 ORDER BY id ASC;",
    [date]
  );
  return result.rows;
}

async function getCompletedItems(date) {
  const result = await db.query("SELECT * FROM items WHERE completed = TRUE AND date = $1 ORDER BY id ASC;",
    [date]
  );
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

  // Get date from query param or default to today
  let date = req.query.date ? moment(req.query.date, 'YYYY-MM-DD') : moment();
  // Generate previous and next dates
  let prevDate = date.clone().subtract(1, 'day').format('YYYY-MM-DD');
  let nextDate = date.clone().add(1, 'day').format('YYYY-MM-DD');
  // Title to display
  let formattedDate = (date.isSame(moment(), 'day') ? "TODAY " : "") + date.format('dddd, D MMMM');

  // fetch the data
  const items = await getItems(date);
  const completedItems = await getCompletedItems(date);
  const error = req.query.error; // Get error from query params

  res.render("index.ejs", {
    date: date,
    prevDate: prevDate,
    nextDate: nextDate,
    formattedDate: formattedDate,
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
  console.log(req.body.checkOffItemId);
  res.redirect("/");
});


app.post("/delete", async (req, res) => {

});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
