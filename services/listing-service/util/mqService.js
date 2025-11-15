// listing-service/util/mqService.js
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = 'platform_events';
const QUEUE_NAME = 'listing_events'; // Giữ lại cho backward compatibility
let connection = null;
let channel = null;
const RETRY_DELAY = 5000; // Thử lại sau 5 giây

async function connectRabbitMQ() {
    try {
        if (connection) return connection;
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        // Assert exchange cho analytics service
        await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });
        
        // Giữ lại queue cũ cho search service (backward compatibility)
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log('✅ Connected to RabbitMQ (Listing Service)');

        // Thêm xử lý lỗi ngắt kết nối
        connection.on("error", (err) => {
            console.error('⚠️ RabbitMQ connection lost. Reconnecting...', err.message);
            connection = null;
            channel = null;
            setTimeout(connectRabbitMQ, RETRY_DELAY);
        });

        return connection;
    } catch (error) {
        // Lỗi kết nối ban đầu (ECONNREFUSED)
        console.error(`❌ RabbitMQ connection error: ${error.message}. Retrying in ${RETRY_DELAY / 1000}s...`);
        // Tự động thử lại
        setTimeout(connectRabbitMQ, RETRY_DELAY);
    }
}

// Hàm mới: Publish event tới exchange (cho analytics service)
async function publishEvent(eventName, data) {
    try {
        if (!channel) {
            await connectRabbitMQ();
        }
        
        if (!channel) {
            console.error('RabbitMQ channel not available. Event not published.');
            return;
        }

        const message = {
            event: eventName,
            data: data
        };

        channel.publish(EXCHANGE_NAME, eventName, Buffer.from(JSON.stringify(message)), {
            persistent: true
        });
        
        console.log(`[MQ] Published event: ${eventName}`);
    } catch (error) {
        console.error(`Error publishing event ${eventName}:`, error.message);
    }
}

// Hàm cũ: Gửi message tới queue (cho search service - backward compatibility)
async function sendMessage(message) {
    if (!channel) {
        await connectRabbitMQ();
    }
    
    if (!channel) {
        console.error('RabbitMQ channel not available. Message dropped or waiting for reconnection.');
        return;
    }
    try {
        const messageString = JSON.stringify(message);
        // Gửi tin nhắn vào Queue (sử dụng assertQueue trong connect)
        channel.sendToQueue(QUEUE_NAME, Buffer.from(messageString), { 
            persistent: true // Giữ tin nhắn trên đĩa cho đến khi Consumer nhận được
        });
        console.log(`[MQ] Sent message: ${message.event} for ID ${message.data?._id || message.id}`);
    } catch (err) {
        console.error('Failed to send message to RabbitMQ:', err.message);
    }
}

// Initialize connection on module load
connectRabbitMQ();

module.exports = { connectRabbitMQ, sendMessage, publishEvent, EXCHANGE_NAME };