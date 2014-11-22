node-red-contrib-sparkcore
--------------------------

Node-RED node to connect to [Spark Core](https://www.spark.io/). This can be used to connect to Spark Core and call functions, read variables or listen to events.

Intsall
-------

    npm install node-red-contrib-sparkcore

Usage
-----

The node implements basic things to interact with Spark Core, such as call a function, read a variable and subscribe to events. This node defines INPUT and OUTPUT nodes. Input node can be used to call a function, read a variable and subscribe to events. The output node can be used to call a function and pass an input parameter. Following are the return values:

**Function call**
 1. msg.raw contains the raw JSON string returned 
 2. msg.payload contains the return value of the function 
 3. msg.id contains the core id 
 4. msg.name contains the core name

**Read a Variable**
 1. msg.raw contains the raw JSON string returned 
 2. msg.payload contains the value of the variable 
 3. msg.name contains the name of the core

**Subscribe to variables**
1. msg.raw contains the raw JSON string returned
2. msg.payload the event data 
3. msg.ttl contains the TTL 
4. msg.published_at contain the published date and time 
5. msg.coreid contains the core id