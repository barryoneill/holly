# Holly: An AWS → Slack messaging lambda

[![Holly](docs/holly.png)](docs/holly.png) 

### What does it do?

The idea of this lambda is to consume arbitrary events from AWS services and send appropriate slack messages based on the content and determined importance of those events.

Right now it's pretty basic - it will:

* consume CodePipeline events sent to it directly via cloudwatch.
* query CodePipeline for execution info and run history
* query Github for additional commit information
* Format and send messages about those events to the configured channel, and if deemed to be a Pipleine state change (OK→Failed or Failed→OK), post those messages into an additional configured channel.

Ideas for further enhancement:

* Add ability to map commit authors to slack handles and directly @ the culprit for failed builds
* Add ability consume other message AWS event types / sources

### Holly? 

From [Wikipedia](https://en.wikipedia.org/wiki/Holly_(Red_Dwarf)):

> Holly is the ship's Tenth Generation AI hologrammatic computer. After releasing Dave Lister from stasis in The End, Holly told him that the crew have been wiped out by a radiation leak and that he had spent three million years in stasis. Holly prides himself on the fact he had an IQ of 6,000,[4] but after three million years by himself, he had become computer senile, or as Holly put it, "a bit peculiar". The crew often ridicule Holly on his senility, but Holly often comes out on top.







