node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/), either via local cloud, or the Particle.io cloud. This can be used to connect to the Particle Core/Photon/P1/Electron, call functions, read variables or listen to Server-Sent-Events (SSEs).

Install
-------

    npm install node-red-contrib-particle

Usage
-----

Refer to the help sidebar for each node in Node-RED for full details.

Three separate nodes are provided to interact with Particle Devices – call a function, read a variable and subscribe to SSEs. The nodes have both INPUT and OUTPUTs – sending appropriate messages (e.g. topic & msg.payload) to the INPUT allows you to change the parameters dynamically.

Where appropriate, the OUTPUT provides returned data from the Particle cloud after a query has been made.

Following are the return values:

**Function call**
 1. msg.raw contains the raw JSON string returned
 2. msg.payload contains the return value of the function
 3. msg.id contains the device id

**Read a Variable**
 1. msg.raw contains the raw JSON string returned
 2. msg.payload contains the value of the variable
 3. msg.id contains the device id

**Subscribe to Server-Sent Events (SSEs)**
 1. msg.raw contains the raw JSON string returned
 2. msg.evtname contains the event name published
 3. msg.payload the event data
 4. msg.id contains the device id
 5. msg.published_at contain the published date and time


Local Cloud and SSE Limitations
-------------------------------

There are [current limitations with the local cloud package from Particle](https://github.com/spark/spark-server/issues/53), which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose. Use a function node to parse out what you need.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123abc...xyz`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123abc...xyz`


Credits
-------

This is a forked project that built off @krvarma's `node-red-contrib-sparkcore` initial work (0.0.12).

Copyright 2015, 2016 Chuan Khoo (node-red-contrib-particle 0.0.2+) for local cloud SSE (limited) support, configuration node implementation, dynamic property setting, implementation of separate nodes for clarity, renaming to Particle and other cosmetic fixes.

Copyright 2014 Krishnaraj Varma (node-red-contrib-sparkcore 0.0.12)
