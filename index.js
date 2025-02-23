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
    // await client.connect();

    const techcollection = client.db("tech-hub").collection("tech");
    const usercollection = client.db("tech-hub").collection("users");
    const reviewcollection = client.db("tech-hub").collection("reviews");
    const reportcollection = client.db("tech-hub").collection("reports");
    const acceptcollection = client.db("tech-hub").collection("accept-product");





   

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


       // accept product 

    app.post("/accept-product", async (req, res) => {
      const { productId } = req.body;
    
      if (!productId) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
      }
    
      try {
        // Fetch the product from the `techCollection`
        const product = await techcollection.findOne({ _id: new ObjectId(productId) });
    
        if (!product) {
          return res.status(404).json({ success: false, message: "Product not found" });
        }
    
        // Add the product to the `acceptCollection`
        const result = await acceptcollection.insertOne(product);
    
        if (result.insertedId) {
          // Update the product status in the `techCollection`
          await techcollection.updateOne(
            { _id: new ObjectId(productId) },
            { $set: { status: "Accepted" } }
          );
    
          return res.status(200).json({ success: true, message: "Product accepted successfully" });
        }
    
        res.status(500).json({ success: false, message: "Failed to accept product" });
      } catch (error) {
        console.error("Error accepting product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    });
    

    app.get("/accept-product", async (req, res) => {
      const result = await acceptcollection.find().sort({ timestamp: -1 }).toArray();
      res.send(result);
    });

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


    app.delete('/tech/:id', async(req,res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await techcollection.deleteOne(query)
      res.send(result)
    })


    app.put("/tech/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
    
      try {
        const result = await techcollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
    
        if (result.modifiedCount > 0) {
          res.status(200).json({ message: "Product updated successfully" });
        } else {
          res.status(400).json({ message: "No changes made or product not found" });
        }
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Failed to update product" });
      }
    });



    // report api 


    app.post("/reports", async (req, res) => {
      try {
        const { productId, reportedBy,productName ,image,votes,tags} = req.body;
    
        if (!productId || !reportedBy) {
          return res.status(400).json({ message: "Product ID and Reporter are required." });
        }
    
        // Check if the product is already reported
        const existingReport = await reportcollection.findOne({ productId });
        if (existingReport) {
          return res.status(400).json({ message: "This product has already been reported." });
        }
    
        // Add the report to the database
        const report = {
          productId,
          reportedBy,
          timestamp: new Date(),
          productName,
          image,
          votes,
          tags
        };
    
        const result = await reportcollection.insertOne(report);
    
        if (result.insertedId) {
          res.status(200).json({ success: true, message: "Product reported successfully." });
        } else {
          res.status(500).json({ success: false, message: "Failed to report product." });
        }
      } catch (error) {
        console.error("Error reporting product:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    

    app.get('/reports', async (req,res) => {
      const result = await reportcollection.find().toArray()
      res.send(result)
    })


    app.delete("/reports/:id", async (req, res) => {
      const { id } = req.params;
    
      try {
        // Delete the product from techcollection
        const techResult = await techcollection.deleteOne({ _id: new ObjectId(id) });
    
        // Delete the product from reportcollection
        const reportResult = await reportcollection.deleteOne({ productId: id });
    
        if (techResult.deletedCount > 0) {
          res.status(200).json({
            message: "Product deleted successfully",
            techDeleted: techResult.deletedCount,
            reportDeleted: reportResult.deletedCount,
          });
        } else {
          res.status(404).json({ message: "Product not found" });
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Failed to delete product", error });
      }
    });

    

  //  review 
   
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


    app.get('/reviews/:proid', async (req, res) => {
      const { proid } = req.params;
    
      try {
        // Validate proid as a valid ObjectId
        if (!ObjectId.isValid(proid)) {
          return res.status(400).send({ message: 'Invalid proid format' });
        }
    
        // Query to filter reviews by proid
        const query = { proid: proid };
        const reviews = await reviewcollection.find(query).toArray();
    
        // If no reviews are found
        if (reviews.length === 0) {
          return res.status(404).send({ message: 'No reviews found for this product' });
        }
    
        res.status(200).send(reviews);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).send({ message: 'Internal server error', error });
      }
    });
    
    
    

    // vote apis

    

    app.post("/accept-product/:id/upvote", async (req, res) => {
      const { id } = req.params;
      const { userId } = req.body;
    
      if (!id || !userId) {
        return res.status(400).json({ message: "Product ID or User ID is missing" });
      }
    
      const product = await acceptcollection.findOne({ _id: new ObjectId(id) });
    
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
    
      if (product.votedUsers?.includes(userId)) {
        return res.status(400).json({ message: "You have already voted on this product" });
      }
    
      const result = await acceptcollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { votes: 1 }, $push: { votedUsers: userId } }
      );
    
      if (result.modifiedCount > 0) {
        res.status(200).json({ votes: product.votes + 1 });
      } else {
        res.status(500).json({ message: "Failed to update vote" });
      }
    });
    


    // user api

    app.delete('/users/:id', async (req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await usercollection.deleteOne(query)
      res.send(result)
    })

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

      app.patch('/users/moderator/:id', verifytoken ,async (req,res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
          $set: {
            role: 'moderator'
          }
        }
        const result = await usercollection.updateOne(filter, updatedDoc)
        res.send(result)
      })

      app.get('/users/moderator/:email', verifytoken,  async (req,res) => {
        const email = req.params.email;
        if ( email !== req.decoded.email){
          return res.status(403).send({message: 'unauthorized access'})
        }

        const query = {email: email}
        const user = await usercollection.findOne(query)
        let moderator = false;
        if (user) {
          moderator = user?.role === 'moderator'
        }
        res.send({moderator})
      })


      app.get('/admin-stats', async (req, res) => {
        try {
          const users = await usercollection.estimatedDocumentCount();
          const menuitem = await techcollection.estimatedDocumentCount();
          res.send({ users, menuitem });
        } catch (error) {
          console.error("Error fetching admin stats:", error);
          res.status(500).send({ error: "Failed to fetch admin stats." });
        }
      });
      

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
