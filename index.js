const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");

const axios = require("axios");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.DB_PASSWORD}@cluster0.vcokv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT middleware
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

async function run() {
  try {
    await client.connect();

    const favoritesCollection = client.db("movieDB").collection("favorites");
    const userCollection = client.db("movieDB").collection("user");

    // JWT issue route
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ error: "Email is required" });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    // Get favorites for user
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

    app.use("/videos", express.static(path.join(__dirname, "videos")));
    // Delete favorite movie by id
    app.delete("/favorites/:id", verifyToken, async (req, res) => {
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: req.email,
      });
      res.send(result);
    });

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
          return res.send(response.data.Search);
        } else {
          return res.status(404).send({ error: response.data.Error });
        }
      } catch (error) {
        console.error("OMDb API error:", error.response?.data || error.message);
        return res
          .status(500)
          .send({ error: "Failed to fetch movies from OMDb" });
      }
    });

    console.log("✅ Server and DB connected, ready to accept requests.");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
  // do not close client here; keep server running
}

run().catch(console.dir);

app.listen(5000, () => console.log("🚀 Server running on port 5000"));
