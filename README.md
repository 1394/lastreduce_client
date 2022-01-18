# lastreduce_client

will write logs to logs.collected[mysql] by logrotate logic

by default unique logs tread = 1000 records

when unique logs tread length exceeed 150% then it be truncated(earlier records) to default (or predefined) length

logs.collected format:
src: string, used as unique logs tread identifier
body: text, original log message
at: datetime, will define right before write to DB
level: string, logs level, info/debug/.../error

# init.js
const lrLog = require('lastreduce_client')
const amqp = require('amqplib')
lrLog.init(config.rmq_url, amqp)

# someActionFile.js , how to use logger
const { makeLogger } = require('lastreduce_client').log
const log = makeLogger('someApp')

log.info('someAction', {name: 'someData1', id: 3556})
log.level('customLogLevel', 'someAction2', {name: 'someData2', id: 2671})

# it will write two log records
# src: someApp.someAction, level: info, body: ...
# src: someApp.someAction2, level: customLogLevel, body: ...
