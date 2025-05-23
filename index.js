const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const axios = require("axios");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.DB_PASSWORD}@cluster0.vcokv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ error: "Invalid token" });
    req.email = decoded.email;
    next();
  });
};

// Main logic
async function run() {
  try {
    await client.connect();

    const db = client.db("movieDB");
    const favoritesCollection = db.collection("favorites");

    // JWT issue route
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ error: "Email is required" });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      res.send({ token });
    });

    // Get favorites
    app.get("/favorites", verifyToken, async (req, res) => {
      const favorites = await favoritesCollection
        .find({ email: req.email })
        .toArray();
      res.send(favorites);
    });

    // Add favorite movie
    app.post("/api/favorites", verifyToken, async (req, res) => {
      const { imdbID, Title, Poster, videoUrl } = req.body;

      if (!imdbID || !Title || !Poster) {
        return res.status(400).send({ error: "Missing required movie data" });
      }

      const favorite = {
        imdbID,
        Title,
        Poster,
        videoUrl,
        email: req.email,
      };

      const result = await favoritesCollection.insertOne(favorite);
      res.send(result);
    });

    // Delete favorite by _id
    app.delete("/favorites/:id", verifyToken, async (req, res) => {
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: req.email,
      });
      res.send(result);
    });
    // Dummy static movies list for default display
    app.get("/api/default-movies", async (req, res) => {
      const titles = [
        "The Notebook",
        "The Blind Side",
        "The Great Gatsby",
        "Les Misérables",
        "The Danish Girl",
        "The Theory of Everything",
        "Me Before You",
        "Call Me by Your Name",
        "The Perks of Being a Wallflower",
        "500 Days of Summer",
        "Marriage Story",
        "Brooklyn",
        "Little Women",
        "The Intern",
        "About Time",
        "The Vow",
        "One Day",
        "A Walk to Remember",
        "The Lucky One",
        "Remember Me",
        "The Spectacular Now",
        "Begin Again",
        "Crazy Rich Asians",
        "The Big Sick",
        "Love, Rosie",
        "Yesterday",
        "La La Land",
        "Silver Linings Playbook",
        "To All the Boys I've Loved Before",
        "Set It Up",
        "Always Be My Maybe",
        "Notting Hill",
        "Love Actually",
        "P.S. I Love You",
        "Bridget Jones's Diary",
        "The Holiday",
        "Crazy, Stupid, Love",
        "Just Go with It",
        "Hitch",
        "The Proposal",
        "27 Dresses",
        "The Ugly Truth",
        "What Women Want",
        "13 Going on 30",
        "She's the Man",
        "Mean Girls",
        "Clueless",
        "Legally Blonde",
        "Easy A",
        "Confessions of a Shopaholic",
        "The Devil Wears Prada",
        "The Princess Diaries",
        "Ella Enchanted",
        "A Cinderella Story",
        "Freaky Friday",
        "High School Musical",
        "Camp Rock",
        "The Parent Trap",
        "Sky High",
        "Enchanted",
        "National Treasure",
        "Night at the Museum",
        "Percy Jackson & the Olympians",
        "Eragon",
        "Inkheart",
        "The Spiderwick Chronicles",
        "Bridge to Terabithia",
        "Narnia: The Lion, the Witch and the Wardrobe",
        "Narnia: Prince Caspian",
        "Narnia: The Voyage of the Dawn Treader",
        "The Golden Compass",
        "Stardust",
        "Pan's Labyrinth",
        "The BFG",
        "Charlie and the Chocolate Factory",
        "Willy Wonka & the Chocolate Factory",
        "Matilda",
        "Coraline",
        "Monster House",
        "The Adventures of Tintin",
        "Treasure Planet",
        "Atlantis: The Lost Empire",
        "The Iron Giant",
        "The Road to El Dorado",
        "Spirit: Stallion of the Cimarron",
        "Ice Age",
        "Madagascar",
        "The Croods",
        "Ferdinand",
        "Bolt",
        "Brother Bear",
        "Open Season",
        "Surf's Up",
        "Cloudy with a Chance of Meatballs",
        "Hotel Transylvania",
        "Rio",
        "Epic",
        "Home",
        "Megamind",
        "Monsters vs. Aliens",
        "Bee Movie",
        "Over the Hedge",
        "Chicken Run",
        "Flushed Away",
        "Arthur Christmas",
        "The Angry Birds Movie",
        "Peter Rabbit",
        "Paddington",
        "Paddington 2",
        "Shaun the Sheep Movie",
        "Wallace & Gromit: The Curse of the Were-Rabbit",
        "Chicken Little",
        "The Wild",
        "Planes",
        "Cars",
        "Cars 2",
        "Cars 3",
        "Turbo",
        "Ballerina",
        "Sing 2",
        "Trolls",
        "Trolls World Tour",
        "The Boss Baby",
        "Storks",
        "Abominable",
      ];

      try {
        const responses = await Promise.all(
          titles.map((title) =>
            axios.get(
              `https://www.omdbapi.com/?apikey=${
                process.env.OMDB_API_KEY
              }&t=${encodeURIComponent(title)}`
            )
          )
        );
        const movies = responses.map((r) => r.data);
        res.send(movies);
      } catch (error) {
        console.error("Default movie fetch error:", error.message);
        res.status(500).send({ error: "Failed to fetch default movies" });
      }
    });

    // OMDb Movie Search
    app.get("/api/search", async (req, res) => {
      const query = req.query.query;
      if (!query) {
        return res.status(400).send({ error: "Query parameter is required" });
      }

      try {
        const response = await axios.get(
          `https://www.omdbapi.com/?apikey=${
            process.env.OMDB_API_KEY
          }&s=${encodeURIComponent(query)}`
        );

        if (response.data.Response === "True") {
          res.send(response.data.Search);
        } else {
          res.status(404).send({ error: response.data.Error });
        }
      } catch (error) {
        console.error("OMDb API error:", error.response?.data || error.message);
        res.status(500).send({ error: "Failed to fetch movies from OMDb" });
      }
    });

    console.log(" Server and DB connected, ready to accept requests.");
  } finally {
    // MongoClient stays open for server lifetime
    // If you need to close in special cases, use: await client.close();
  }
}
// Run server
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send(" Movie Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
