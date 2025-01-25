const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c3mzl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const techcollection = client.db("tech-hub").collection("tech");
    const usercollection = client.db("tech-hub").collection("users");
    const reviewcollection = client.db("tech-hub").collection("reviews");


    // jwt api 

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    // middleware 

    const verifytoken = (req,res,next) => {
        console.log('inside',req.headers.authorization)
        if(!req.headers.authorization){
          return res.status(401).send({message: 'forbidden access'})
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if(err){
            return res.status(401).send({message: 'forbidden access'})
          }
          req.decoded = decoded;
          next()
        })
        // next()
      }
  
  
      const verifyadmin = async (req,res,next) => {
        const email = req.decoded.email;
        const query = {email: email};
        const user = await usercollection.findOne(query);
        const isadmin = user?.role === 'admin';
        if(!isadmin){
          return res.status(403).send({message: 'forbidden access'})
        }
        next()
      }

    // tech api

    app.post("/tech", async (req, res) => {
      const item = req.body;
      item.timestamp = new Date();

      const result = await techcollection.insertOne(item);
      res.send(result);
    });

    app.get("/tech", async (req, res) => {
      const result = await techcollection.find().sort({ timestamp: -1 }).toArray();
      res.send(result);
    });

   

    app.get('/tech/:id', async (req, res) => {
      const id = req.params.id;
    
      try {
        // Validate the ID
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid ID format' });
        }
    
        // Create query with valid ObjectId
        const query = { _id: new ObjectId(id) };
    
        // Fetch the document from the collection
        const result = await techcollection.findOne(query);
    
        // Handle case where the document is not found
        if (!result) {
          return res.status(404).send({ message: 'Document not found' });
        }
    
        res.status(200).send(result);
      } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).send({ message: 'Internal server error', error });
      }
    });



    

   
    //   try {
    //     // Extract the owner email from params and decoded token
    //     const owneremail = req.params.owneremail;
    //     const decodedEmail = req.decoded?.email;
    
    //     // Verify that the email in the token matches the email in the request
    //     if (owneremail !== decodedEmail) {
    //       return res.status(403).send({ message: "Forbidden access" });
    //     }
    
    //     // Query only the documents where owneremail matches
    //     const query = { owneremail: owneremail };
    //     const result = await techcollection.find(query).toArray();
    
    //     // Send the filtered data
    //     res.status(200).send(result);
    //   } catch (error) {
    //     console.error("Error fetching data:", error);
    //     res.status(500).send({ message: "An error occurred while fetching data." });
    //   }
    // });


    // review apis 

    app.post("/reviews", async (req, res) => {
      const item = req.body;
      item.timestamp = new Date();

      const result = await reviewcollection.insertOne(item);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewcollection.find().sort({ timestamp: -1 }).toArray();
      res.send(result);
    });


    
    
    

    // vote apis

    app.post("/tech/upvote/:id",verifytoken, async (req, res) => {
      const productId = req.params.id;
      const userEmail = req.body.email;
    
      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: "Invalid product ID" });
      }
    
      try {
        // Check if the user has already upvoted the product
        const product = await techcollection.findOne({ _id: new ObjectId(productId) });
    
        if (!product) {
          return res.status(404).send({ message: "Product not found" });
        }
    
        // Prevent the product owner from upvoting their own product
        if (product.owneremail === userEmail) {
          return res.status(403).send({ message: "You cannot upvote your own product" });
        }
    
        // Check if user has already voted
        const hasUpvoted = product.upvoters?.includes(userEmail);
    
        if (hasUpvoted) {
          return res.status(400).send({ message: "You have already upvoted this product" });
        }
    
        // Update the product votes and add the user to upvoters array
        const updateResult = await techcollection.updateOne(
          { _id: new ObjectId(productId) },
          {
            $inc: { votes: 1 },
            $push: { upvoters: userEmail },
          }
        );
    
        if (updateResult.modifiedCount > 0) {
          res.send({ message: "Upvote successful" });
        } else {
          res.status(500).send({ message: "Failed to upvote the product" });
        }
      } catch (error) {
        console.error("Error upvoting product:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



    // user api

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existuser = await usercollection.findOne(query);
      if (existuser) {
        return res.send({ message: "user already exist", insertedId: null });
      }

      const result = await usercollection.insertOne(user);
      res.send(result);
    });

    app.get("/users",verifytoken, async (req, res) => {
      const result = await usercollection.find().toArray();
      res.send(result);
    });

    app.patch('/users/admin/:id', verifytoken ,async (req,res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await usercollection.updateOne(filter, updatedDoc)
        res.send(result)
      })

      app.get('/users/admin/:email', verifytoken,  async (req,res) => {
        const email = req.params.email;
        if ( email !== req.decoded.email){
          return res.status(403).send({message: 'unauthorized access'})
        }

        const query = {email: email}
        const user = await usercollection.findOne(query)
        let admin = false;
        if (user) {
          admin = user?.role === 'admin'
        }
        res.send({admin})
      })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("tech is running");
});

app.listen(port, () => {
  console.log("tech is run port ");
});
