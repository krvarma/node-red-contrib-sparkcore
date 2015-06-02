node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/). This can be used to connect to the Particle Core/Photon, and call functions, read variables or listen to Server-Sent-Events (SSEs).

Install
-------

    npm install node-red-contrib-particle

Usage
-----

The node implements basic things to interact with Particle Core, such as call a function, read a variable and subscribe to SSEs. This node defines INPUT and OUTPUT nodes. The Input node can be used to call a function, read a variable and subscribe to events. The output node can be used to call a function and pass an input parameter. Following are the return values:

**Function call**
 1. msg.raw contains the raw JSON string returned 
 2. msg.payload contains the return value of the function 
 3. msg.id contains the core id 

**Read a Variable**
 1. msg.raw contains the raw JSON string returned 
 2. msg.payload contains the value of the variable 
 3. msg.id contains the core id 

**Subscribe to Server-Sent Events (SSEs)**
 1. msg.raw contains the raw JSON string returned
 2. msg.payload the event data 
 3. msg.id contains the core id
 4. msg.published_at contain the published date and time


Local Cloud and SSE Limitations
-------------------------------

There are current limitations with the local cloud package from Particle, which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123456789abcdef123456789abcdef123456789a`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123456789abcdef123456789abcdef123456789a`


Credits
-------

This is a forked project that built off @krvarma's node-red-contrib-sparkcore initial work (0.0.12).

Copyright 2014 Krishnaraj Varma (node-red-contrib-sparkcore 0.0.12)

Copyright 2015 Chuan Khoo (node-red-contrib-particle 0.0.1) for local cloud SSE (limited) support, configuration node implementation, renaming to Particle, and cosmetic fixes.

