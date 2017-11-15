node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/), either via local cloud, or the Particle.io cloud. This can be used to connect to the Particle Core/Photon/P1/Electron, call functions, read variables or listen to Server-Sent-Events (SSEs).

Install
-------

    npm install node-red-contrib-particle

Usage
-----

Three separate nodes are provided to interact with Particle Devices – call a function, read a variable and subscribe to SSEs. The nodes have both INPUT and OUTPUTs – sending appropriate messages (e.g. topic & msg.payload) to the INPUT allows you to change the parameters dynamically.

Where appropriate, the OUTPUT provides returned data from the Particle cloud after a query has been made.

Please refer to the help sidebar in node-RED for full details on each node.

Basic Example
-------------

Write something similar to this in your Particle Build code:

```
void loop() {
    Particle.publish("randomnumber", String(random(100)), PRIVATE);
    delay(10000);
}
```

In node-RED, drop a Particle SSE node into the workspace, and connect a debug node to view the output:

_[todo: image]_

Configure the Particle node by adding your own Particle configuration credentials and access token.

View the results via the debug node.


FAQ
---

  **I keep getting an Error in the ParticleSSE node!**  
  It's likely your Particle.io access token is incorrect. Regenerate a new token in build.particle.io, and try again with the new token in the configuration node.



Local Cloud and SSE Limitations
-------------------------------

There are [current limitations with the local cloud package from Particle](https://github.com/spark/spark-server/issues/53), which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose. Use a function node to parse out what you need.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123abc...xyz`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123abc...xyz`


Credits
-------

This is a forked project that built off @krvarma's `node-red-contrib-sparkcore` initial work (0.0.12).

Additional features implemented from `node-red-contrib-particle 0.0.2+`:
* local cloud SSE (limited) support
* configuration node implementation
* dynamic property setting
* implementation of separate nodes for clarity
* renaming to Particle and other cosmetic fixes.
