const locals = {
  conn: false,
  channels: {},
  amqp: false,
  url: false,
}

const logg = (...args) => {
  console.log('\n')
  console.log('*'.repeat(120))
  console.log.call(this, ...args)
  console.log('*'.repeat(120))
  console.log('\n')
}

const getConn = async function() {
  logg('start getConn: ', locals.url.split('@').pop())
  if (locals.conn) {
    return locals.conn
  } else {
    locals.conn = await locals.amqp.connect(locals.url)
      .catch((err) => {
        console.error(err)
        logg('getConn error: ', err)
        return false
      })
    locals.conn.on('error', (error) => {
      console.error('RMQ connection error: ', error)
      locals.conn = undefined
      logg('RMQ connection error: ', error)
    })
    locals.conn.on('close', () => {
      console.error('RMQ connection closed')
      locals.conn = undefined
      logg('RMQ connection closed: ')
    })
    return locals.conn
  }
}

const getChannel = async (key, opts = {}) => {
  if (key) {
    if (!locals.channels[key]) {
      const conn = await getConn()
      if (opts.confirm) {
        console.log('[rmq] createConfirmChannel')
        locals.channels[key] = await conn.createConfirmChannel()
      } else {
        console.log('[rmq] createChannel')
        locals.channels[key] = await conn.createChannel()
      }
      locals.channels[key].on('close', () => {
        console.error('RMQ channel closed')
        logg('RMQ channel closed: ')
        locals.channels[key] = undefined
      })
    }
    locals.channels[key].prefetch(1)
    return locals.channels[key]
  } else {
    if (!locals.channel) {
      const conn = await getConn()
      locals.channel = await conn.createChannel()
      locals.channel.on('close', () => {
        console.error('RMQ channel closed')
        logg('RMQ channel closed: ')
        locals.channel = undefined
      })
    }
    locals.channel.prefetch(1)
    return locals.channel
  }
}

const sendEvent = async function(queue, msg, opts = {}) {
  if (typeof queue !== 'string' && queue.queue) {
    msg = queue
    opts = queue.opts || {}
    queue = queue.queue
  }
  if (!msg) {
    throw new Error(`[error] sendEvent msg is empty! ${queue} : ${opts}`)
  }
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg)
    } catch (ex) {
      console.error('rmq.sendEvent error: ', ex)
    }
  }
  if (!queue) {
    throw new Error('queue cant be empty')
  }
  const me = this
  me.ch = await getChannel('sendEvent', opts)
  opts.debug && console.log('sendEvent ch: ', !!me.ch)
  if (me.ch) {
    opts.debug && console.log('sendEvent msg: ', msg)
    if (opts.confirm) {
      await new Promise((resolve, reject) => {
        me.ch.sendToQueue(queue, Buffer.from(msg), {}, (err, ok) => {
          if (err) {
            return reject(err)
          } else {
            return resolve(ok)
          }
        })
      })
    } else {
      await me.ch.sendToQueue(queue, Buffer.from(msg))
    }
  }
  opts.debug && console.log('EOF sendEvent')
  opts.debug && console.log('*'.repeat(100))
}

/**
 * universal log function
 * @param {Object} params
 * @param {String} params.app app name
 * @param {String} params.level app log level
 * @param {Datetime} params.at event datetime
 * @param {String|Object|Array} params.body log body, if not String then convert to JSON (beware of circular data)
 */
const log = ({app, level, at, body}) => {
  return sendEvent('lastreduce', {
    app,
    level,
    at,
    body,
  })
}

const getActions = (app, actions) => {
  if (Array.isArray(actions)) {
    return actions.length ? app + '.' + actions.join('.') : app
  }
  if (typeof actions === 'string') {
    return actions ? app + '.' + actions : app
  }
}

/**
 * 
 * @param {String} app app name
 * @returns {Object} log
 * @returns {Function} log.level (level, actions, msg)
 * @returns {Function} log.debug (actions, msg)
 * @returns {Function} log.error (actions, msg)
 * @returns {Function} log.warn (actions, msg)
 * @returns {Function} log.info (actions, msg)
 */
log.makeLogger = (app) => {
  const level = (level, actions, msg) => {
    return log({
      level,
      at: new Date(),
      body: msg,
      app: getActions(app, actions)
    })
  }
  return {
    level,
    error: (...args) => level('error', ...args),
    warn: (...args) => level('warn', ...args),
    info: (...args) => level('info', ...args),
    debug: (...args) => level('debug', ...args),
  }
}

/**
 * 
 * @param {String} url 
 * @param {Object} amqp amqplib module
 */
const init = (url, amqp) => {
  locals.url = url
  locals.amqp = amqp
  if (!url) {
    throw new Error('cant init with empty rmq url!')
  }
  if (!amqp) {
    throw new Error('cant init without amqp! make require("amqp") in a project and send as second param')
  }
}


module.exports = {
  init,
  log
}
