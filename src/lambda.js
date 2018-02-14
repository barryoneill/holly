
const eventHandlers = [
    require('./handlers/codepipeline')
];

exports.handler = (event, context, callback) => {

    const handler = eventHandlers.find(h => h.handles(event));
    if (handler) {
        callback(null, handler.handle(event));
    }
    else {
        callback('No handler for: ' + JSON.stringify(event, null, 2));
    }

};

