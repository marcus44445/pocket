const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let ohlcHistory = []; // Stores OHLC data
let marketStructure = []; // Stores market structure points;

// === Receive OHLC Data from Client ===
app.post('/data', (req, res) => {
    const { open, high, low, close, timestamp } = req.body;
    if (open !== undefined && high !== undefined && low !== undefined && close !== undefined && timestamp) {
        const ohlc = { open, high, low, close, timestamp };
        ohlcHistory.push(ohlc);
        if (ohlcHistory.length > 100) ohlcHistory.shift(); // Keep only the latest 100 entries
        console.log('✅ Received OHLC:', ohlc);
        res.json({ message: 'OHLC data received' });
    } else {
        console.error('❌ Invalid OHLC data:', req.body);
        res.status(400).json({ message: 'Invalid OHLC data' });
    }
});

// === Manual RSI Calculation ===
function calculateRSI(closingPrices, period) {
    if (closingPrices.length < period) return null;

    let gains = 0, losses = 0;

    for (let i = closingPrices.length - period; i < closingPrices.length - 1; i++) {
        const change = closingPrices[i + 1] - closingPrices[i];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100; // Prevent division by zero

    const rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
}

// === Bollinger Bands Calculation ===
function calculateBollingerBands(closingPrices, period = 5, deviation = 1) {
    if (closingPrices.length < period) return null;

    const recentPrices = closingPrices.slice(-period);
    const avg = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const stdDev = Math.sqrt(recentPrices.map(p => (p - avg) ** 2).reduce((sum, val) => sum + val, 0) / period);

    return {
        bb_upper_p5_dev1: avg + (deviation * stdDev),
        bb_lower_p5_dev1: avg - (deviation * stdDev)
    };
}

// === Calculate CCI (p4) ===
function calculateCCI(closingPrices, highs, lows, period = 4) {
    if (closingPrices.length < period) return null;

    const typicalPrices = closingPrices.slice(-period).map((close, i) => (highs[i] + lows[i] + close) / 3);
    const avgTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - avgTP), 0) / period;

    if (meanDeviation === 0) return null; // Prevent division by zero
    return parseFloat(((typicalPrices[typicalPrices.length - 1] - avgTP) / (0.015 * meanDeviation)).toFixed(2));
}

// === Calculate MACD (Fast: 50, Slow: 2, Signal: 2) ===
function calculateMACD(closingPrices, shortPeriod = 50, longPeriod = 2, signalPeriod = 2) {
    if (closingPrices.length < shortPeriod) return null;

    function exponentialMovingAverage(data, period) {
        const alpha = 2 / (period + 1);
        return data.reduce((prev, curr, index) => {
            return index === 0 ? curr : (curr * alpha + prev * (1 - alpha));
        }, 0);
    }

    const shortEMA = exponentialMovingAverage(closingPrices.slice(-shortPeriod), shortPeriod);
    const longEMA = exponentialMovingAverage(closingPrices.slice(-longPeriod), longPeriod);
    const macd = shortEMA - longEMA;
    const signalLine = exponentialMovingAverage(closingPrices.slice(-signalPeriod), signalPeriod);
    const macdHistogram = macd - signalLine;

    return { macd, signalLine, macdHistogram };
}

// === Calculate Indicators with Updated MACD ===
app.get('/indicators', (req, res) => {
    if (ohlcHistory.length >= 50) { // Ensure minimum history length meets MACD requirements
        const closingPrices = ohlcHistory.map(data => data.close);
        const highs = ohlcHistory.map(data => data.high);
        const lows = ohlcHistory.map(data => data.low);
        const latestPrice = closingPrices[closingPrices.length - 1];

        // Calculate indicators
        const rsi10 = calculateRSI(closingPrices, 10);
        const cci4 = calculateCCI(closingPrices, highs, lows, 4);
        const bollingerBands = calculateBollingerBands(closingPrices, 5, 1);
        const macdData = calculateMACD(closingPrices, 50, 2, 2); // Updated MACD parameters

        res.json({
            latestPrice,
            rsi10,
            cci4,
            ...bollingerBands,
            macd: macdData
        });
    } else {
        res.status(404).json({ message: 'Insufficient OHLC data for indicators' });
    }
});

// === Start Server ===
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});