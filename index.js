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

async function getAllItems() {
  const result = await db.query("SELECT * FROM items ORDER BY date ASC;" );
  return result.rows;
}

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

async function addItem(title, date) {
  const result = await db.query("INSERT INTO items (title, date) VALUES ($1, $2) RETURNING *;",
    [title, date]);
  return result.rows;
}

async function editItem(id, newTitle) {
  const result = await db.query("UPDATE items SET title = $1 WHERE id = $2;",
    [newTitle, id]
  );
  return result.rows;
}

async function checkOffItem(id) {
  await db.query("UPDATE items SET completed = TRUE WHERE id = $1;",
    [id]);
}

async function deleteItem(id) {
  await db.query("DELETE FROM items WHERE id = $1;", 
    [id]);
}

async function returnItem(id) {
  await db.query("UPDATE items SET completed = FALSE WHERE id = $1;",
    [id]);
}

function validateAndFormatDate(inputDate) {
  let date = inputDate ? new Date(inputDate) : new Date(); // Parse input or use today
  // Ensure the date is valid
  if (isNaN(date.getTime())) {
      return { error: "Invalid date provided", date: new Date().toISOString().split("T")[0] };
  }
  // Convert date to YYYY-MM-DD format
  return { error: null, date: date.toISOString().split("T")[0] };
}

app.get("/view-list", async (req, res) => {
  
  let allItems = await getAllItems();
  let todayDate = new Date();

  for (let item of allItems) {
    item.dateURL = item.date.toISOString().split("T")[0]
    item.isItToday = item.dateURL === todayDate.toISOString().split("T")[0]
    const options = { weekday: "short", day: "numeric", month: "long" };
    let formattedDate = item.date.toLocaleDateString("en-GB", options);
    item.date =  formattedDate;
  }

  console.log(allItems);

  res.render("view-list.ejs", 
    {
      listItems: allItems,
      error: req.query.error,
    }
  );
});

app.get("/today", async (req, res) => {
  
  const todayDate = new Date();
  const formattedTodayDate = todayDate.toISOString().split("T")[0];

  res.redirect(`/?date=${formattedTodayDate}`);

});

app.get("/", async (req, res) => {
  let dateParam = req.query.date; // Get date from query param
  let date = dateParam ? new Date(dateParam) : new Date(); // Parse or use today

  // Ensure the date is valid
  if (isNaN(date.getTime())) {
      date = new Date(); // Default to today if invalid
  }

  // Format for URL and database (YYYY-MM-DD) using local time
  const formattedDate = date.toLocaleDateString("en-CA"); // Ensures YYYY-MM-DD format in local time

  // Work out if it is today
  const todayDate = new Date();
  const formattedTodayDate = todayDate.toLocaleDateString("en-CA");
  const isItToday = formattedDate === formattedTodayDate;

  // Get previous and next dates
  let prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);

  let nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);

  // Convert to YYYY-MM-DD using local time to prevent timezone issues
  prevDate = prevDate.toLocaleDateString("en-CA");
  nextDate = nextDate.toLocaleDateString("en-CA");

  // Title format: "TODAY, Monday, 5 February"
  const options = { weekday: "long", day: "numeric", month: "long" };
  const displayDate = date.toLocaleDateString("en-GB", options);

  // **Predefine Empty Lists** to avoid flicker
  let items = [];
  let completedItems = [];

  try {
      // Fetch items for selected date
      items = await getItems(formattedDate);
      completedItems = await getCompletedItems(formattedDate);
  } catch (error) {
      console.error("Error fetching items:", error);
  }

  res.render("index.ejs", {
      date: formattedDate, // Ensure YYYY-MM-DD format
      prevDate,
      nextDate,
      formattedDate: displayDate, // Always a valid string
      listItems: items || [], // Ensure it's always an array
      completedListItems: completedItems || [], // Ensure it's always an array
      isItToday: isItToday,
      error: req.query.error || null, // Ensure error is always defined
  });
});




app.post("/add", async (req, res) => {
  const itemText = req.body.newItemText;
  const { error, date } = validateAndFormatDate(req.body.date);

  if (error) {
      return res.redirect(`/?error=${error}`);
  }

  if (itemText) {
      await addItem(itemText, date);
      res.redirect(`/?date=${date}`);
  } else {
      res.redirect(`/?date=${date}&error=Please enter some text`);
  }
});


app.post("/edit", async (req, res) => {
  const updatedItemTitle = req.body.updatedItemTitle;
  const itemId = req.body.updatedItemId;
  const { error, date } = validateAndFormatDate(req.body.date);

  if (error) {
      return res.redirect(`/?error=${error}`);
  } 
  
  await editItem(itemId, updatedItemTitle);
  res.redirect(`/?date=${date}`);
  
});

app.post("/check-off", async (req, res) => {
  const itemId = req.body.checkOffItemId;
  const { error, date } = validateAndFormatDate(req.body.date);

  if (error) {
      return res.redirect(`/?error=${error}`);
  }

  await checkOffItem(itemId);
  res.redirect(`/?date=${date}`);
});

app.post("/check-off/view-list", async (req, res) => {
  const itemId = req.body.checkOffItemId;

  try {
    await checkOffItem(itemId);
    res.redirect("/view-list");

  } catch (error) {
    console.error("Error checking off item:", error); // Logs error to the console
    res.redirect("/view-list");
  }
});


app.post("/delete", async (req, res) => {
  const itemId = req.body.deleteItemId;
  const { error, date } = validateAndFormatDate(req.body.date);

  console.log("delete item: ", itemId)

  if (error) {
      return res.redirect(`/?error=${error}`);
  }

  await deleteItem(itemId);
  res.redirect(`/?date=${date}`);
});

app.post("/return-item", async (req, res) => {
  const itemId = req.body.returnItemId;
  const { error, date } = validateAndFormatDate(req.body.date);

  if (error) {
      return res.redirect(`/?error=${error}`);
  }

  await returnItem(itemId);
  res.redirect(`/?date=${date}`);
});

app.post("/return-item/view-list", async (req, res) => {
  const itemId = req.body.returnItemId;

  try {
    await returnItem(itemId);
    res.redirect("/view-list");

  } catch (error) {
    console.error("Error returning item:", error); // Logs error to the console
    res.redirect("/view-list");

  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
