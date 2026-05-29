const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 12345;

// Middleware
app.use(cors());
app.use(express.json());

// Class UltraDicePredictionSystem
class UltraDicePredictionSystem {
    constructor() {
        this.history = [];
        this.models = {};
        this.weights = {};
        this.performance = {};
        this.patternDatabase = {};
        this.advancedPatterns = {};
        this.sessionStats = {
            streaks: { T: 0, X: 0, maxT: 0, maxX: 0 },
            transitions: { TtoT: 0, TtoX: 0, XtoT: 0, XtoX: 0 },
            volatility: 0.5,
            patternConfidence: {},
            recentAccuracy: 0,
            bias: { T: 0, X: 0 }
        };
        this.marketState = {
            trend: 'neutral',
            momentum: 0,
            stability: 0.5,
            regime: 'normal'
        };
        this.adaptiveParameters = {
            patternMinLength: 3,
            patternMaxLength: 8,
            volatilityThreshold: 0.7,
            trendStrengthThreshold: 0.6,
            patternConfidenceDecay: 0.95,
            patternConfidenceGrowth: 1.05
        };
        this.previousTopModels = null;
        this.initAllModels();
    }

    initAllModels() {
        for (let i = 1; i <= 21; i++) {
            this.models[`model${i}`] = this[`model${i}`].bind(this);
            this.models[`model${i}Mini`] = this[`model${i}Mini`].bind(this);
            this.models[`model${i}Support1`] = this[`model${i}Support1`].bind(this);
            this.models[`model${i}Support2`] = this[`model${i}Support2`].bind(this);
            
            this.weights[`model${i}`] = 1;
            this.performance[`model${i}`] = { 
                correct: 0, 
                total: 0,
                recentCorrect: 0,
                recentTotal: 0,
                streak: 0,
                maxStreak: 0
            };
        }
        
        this.initPatternDatabase();
        this.initAdvancedPatterns();
        this.initSupportModels();
    }

    initPatternDatabase() {
        this.patternDatabase = {
            '1-1': { pattern: ['T', 'X', 'T', 'X'], probability: 0.7, strength: 0.8 },
            '1-2-1': { pattern: ['T', 'X', 'X', 'T'], probability: 0.65, strength: 0.75 },
            '2-1-2': { pattern: ['T', 'T', 'X', 'T', 'T'], probability: 0.68, strength: 0.78 },
            '3-1': { pattern: ['T', 'T', 'T', 'X'], probability: 0.72, strength: 0.82 },
            '1-3': { pattern: ['T', 'X', 'X', 'X'], probability: 0.72, strength: 0.82 },
            '2-2': { pattern: ['T', 'T', 'X', 'X'], probability: 0.66, strength: 0.76 },
            '2-3': { pattern: ['T', 'T', 'X', 'X', 'X'], probability: 0.71, strength: 0.81 },
            '3-2': { pattern: ['T', 'T', 'T', 'X', 'X'], probability: 0.73, strength: 0.83 },
            '4-1': { pattern: ['T', 'T', 'T', 'T', 'X'], probability: 0.76, strength: 0.86 },
            '1-4': { pattern: ['T', 'X', 'X', 'X', 'X'], probability: 0.76, strength: 0.86 },
        };
    }

    initAdvancedPatterns() {
        this.advancedPatterns = {
            'dynamic-1': {
                detect: (data) => {
                    if (data.length < 6) return false;
                    const last6 = data.slice(-6);
                    return last6.filter(x => x === 'T').length === 4 && 
                           last6[last6.length-1] === 'T';
                },
                predict: () => 'X',
                confidence: 0.72,
                description: "4T trong 6 phiên, cuối là T -> dự đoán X"
            },
            'dynamic-2': {
                detect: (data) => {
                    if (data.length < 8) return false;
                    const last8 = data.slice(-8);
                    const tCount = last8.filter(x => x === 'T').length;
                    return tCount >= 6 && last8[last8.length-1] === 'T';
                },
                predict: () => 'X',
                confidence: 0.78,
                description: "6+T trong 8 phiên, cuối là T -> dự đoán X mạnh"
            },
            'alternating-3': {
                detect: (data) => {
                    if (data.length < 5) return false;
                    const last5 = data.slice(-5);
                    for (let i = 1; i < last5.length; i++) {
                        if (last5[i] === last5[i-1]) return false;
                    }
                    return true;
                },
                predict: (data) => data[data.length-1] === 'T' ? 'X' : 'T',
                confidence: 0.68,
                description: "5 phiên đan xen hoàn hảo -> dự đoán đảo chiều"
            },
            'cyclic-7': {
                detect: (data) => {
                    if (data.length < 14) return false;
                    const firstHalf = data.slice(-14, -7);
                    const secondHalf = data.slice(-7);
                    return this.arraysEqual(firstHalf, secondHalf);
                },
                predict: (data) => data[data.length-7],
                confidence: 0.75,
                description: "Chu kỳ 7 phiên lặp lại -> dự đoán theo chu kỳ"
            },
            'momentum-break': {
                detect: (data) => {
                    if (data.length < 9) return false;
                    const first6 = data.slice(-9, -3);
                    const last3 = data.slice(-3);
                    const firstT = first6.filter(x => x === 'T').length;
                    const firstX = first6.filter(x => x === 'X').length;
                    return Math.abs(firstT - firstX) >= 4 && 
                           new Set(last3).size === 1 &&
                           last3[0] !== (firstT > firstX ? 'T' : 'X');
                },
                predict: (data) => {
                    const first6 = data.slice(-9, -3);
                    const firstT = first6.filter(x => x === 'T').length;
                    const firstX = first6.filter(x => x === 'X').length;
                    return firstT > firstX ? 'T' : 'X';
                },
                confidence: 0.71,
                description: "Momentum mạnh bị phá vỡ -> quay lại momentum chính"
            },
            'hybrid-pattern': {
                detect: (data) => {
                    if (data.length < 10) return false;
                    const segment = data.slice(-10);
                    const tCount = segment.filter(x => x === 'T').length;
                    const transitions = segment.slice(1).filter((x, i) => x !== segment[i]).length;
                    return tCount >= 3 && tCount <= 7 && transitions >= 6;
                },
                predict: (data) => {
                    const last = data[data.length-1];
                    const secondLast = data[data.length-2];
                    return last === secondLast ? (last === 'T' ? 'X' : 'T') : last;
                },
                confidence: 0.65,
                description: "Pattern hỗn hợp cao -> dự đoán based on last transitions"
            }
        };
    }

    initSupportModels() {
        for (let i = 1; i <= 21; i++) {
            this.models[`model${i}Support3`] = this[`model${i}Support3`].bind(this);
            this.models[`model${i}Support4`] = this[`model${i}Support4`].bind(this);
        }
    }

    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    addResult(result) {
        if (this.history.length > 0) {
            const lastResult = this.history[this.history.length-1];
            const transitionKey = `${lastResult}to${result}`;
            this.sessionStats.transitions[transitionKey] = (this.sessionStats.transitions[transitionKey] || 0) + 1;
            
            if (result === lastResult) {
                this.sessionStats.streaks[result]++;
                this.sessionStats.streaks[`max${result}`] = Math.max(
                    this.sessionStats.streaks[`max${result}`],
                    this.sessionStats.streaks[result]
                );
            } else {
                this.sessionStats.streaks[result] = 1;
                this.sessionStats.streaks[lastResult] = 0;
            }
        } else {
            this.sessionStats.streaks[result] = 1;
        }
        
        this.history.push(result);
        if (this.history.length > 200) {
            this.history.shift();
        }
        
        this.updateVolatility();
        this.updatePatternConfidence();
        this.updateMarketState();
    }

    updateVolatility() {
        if (this.history.length < 10) return;
        const recent = this.history.slice(-10);
        let changes = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i] !== recent[i-1]) changes++;
        }
        this.sessionStats.volatility = changes / (recent.length - 1);
    }

    updatePatternConfidence() {
        for (const [patternName, confidence] of Object.entries(this.sessionStats.patternConfidence)) {
            if (this.history.length < 2) continue;
            const lastResult = this.history[this.history.length-1];
            if (this.advancedPatterns[patternName]) {
                const prediction = this.advancedPatterns[patternName].predict(this.history.slice(0, -1));
                if (prediction !== lastResult) {
                    this.sessionStats.patternConfidence[patternName] = Math.max(
                        0.1, 
                        confidence * this.adaptiveParameters.patternConfidenceDecay
                    );
                } else {
                    this.sessionStats.patternConfidence[patternName] = Math.min(
                        0.95, 
                        confidence * this.adaptiveParameters.patternConfidenceGrowth
                    );
                }
            }
        }
    }

    updateMarketState() {
        if (this.history.length < 15) return;
        const recent = this.history.slice(-15);
        const tCount = recent.filter(x => x === 'T').length;
        const xCount = recent.filter(x => x === 'X').length;
        this.sessionStats.bias.T = tCount / recent.length;
        this.sessionStats.bias.X = xCount / recent.length;

        if (Math.abs(tCount - xCount) >= 5) {
            this.marketState.trend = tCount > xCount ? 'bullish' : 'bearish';
            this.marketState.regime = 'trending';
        } else if (this.sessionStats.volatility > this.adaptiveParameters.volatilityThreshold) {
            this.marketState.trend = 'neutral';
            this.marketState.regime = 'volatile';
        } else {
            this.marketState.trend = 'neutral';
            this.marketState.regime = 'normal';
        }
    }

    updatePerformance(actualResult) {
        // Cập nhật độ chính xác gần đây
        let recentMatches = 0;
        let recentTotalCount = 0;

        for (const [modelName, modelFn] of Object.entries(this.models)) {
            const perf = this.performance[modelName] || { correct: 0, total: 0, recentCorrect: 0, recentTotal: 0, streak: 0, maxStreak: 0 };
            
            // Lấy dự đoán trước khi có kết quả thực tế này
            const historicalHistory = this.history.slice(0, -1);
            if (historicalHistory.length >= 8) {
                const pred = modelFn(historicalHistory);
                if (pred) {
                    perf.total++;
                    perf.recentTotal++;
                    if (pred === actualResult) {
                        perf.correct++;
                        perf.recentCorrect++;
                        perf.streak++;
                        perf.maxStreak = Math.max(perf.maxStreak, perf.streak);
                    } else {
                        perf.streak = 0;
                    }
                }
            }
            
            if (perf.recentTotal > 20) {
                perf.recentCorrect = Math.round(perf.recentCorrect * 0.9);
                perf.recentTotal = Math.round(perf.recentTotal * 0.9);
            }
            this.performance[modelName] = perf;
        }
    }

    getFinalPrediction() {
        if (this.history.length < 8) return null;
        
        // Kiểm tra các Pattern nâng cao trước
        for (const [name, pattern] of Object.entries(this.advancedPatterns)) {
            if (pattern.detect(this.history)) {
                return {
                    prediction: pattern.predict(this.history),
                    confidence: pattern.confidence,
                    source: `Advanced Pattern: ${name}`
                };
            }
        }

        // Bỏ phiếu từ database tĩnh dựa trên chuỗi 8 ký tự cuối
        const last8 = this.history.slice(-8).join('');
        if (staticDatabase[last8]) {
            return {
                prediction: staticDatabase[last8] === 'Tài' ? 'T' : 'X',
                confidence: 0.85,
                source: 'Static Pattern Database (thuattoan8)'
            };
        }

        // Đồng thuận từ các model động dựa trên trọng số hiệu suất
        let weightT = 0;
        let weightX = 0;

        for (const [modelName, modelFn] of Object.entries(this.models)) {
            const pred = modelFn(this.history);
            if (!pred) continue;

            const perf = this.performance[modelName];
            let accuracy = perf && perf.total > 0 ? (perf.correct / perf.total) : 0.5;
            let recentAccuracy = perf && perf.recentTotal > 0 ? (perf.recentCorrect / perf.recentTotal) : 0.5;
            
            let finalWeight = (accuracy * 0.4) + (recentAccuracy * 0.6);
            if (perf && perf.streak > 2) finalWeight *= 1.2;

            if (pred === 'T') weightT += finalWeight;
            if (pred === 'X') weightX += finalWeight;
        }

        const totalWeight = weightT + weightX;
        if (totalWeight === 0) return null;

        const mainPrediction = weightT > weightX ? 'T' : 'X';
        const confidence = Math.max(weightT, weightX) / totalWeight;

        return {
            prediction: mainPrediction,
            confidence: confidence,
            source: 'Dynamic Model Ensemble'
        };
    }

    // Các thuật toán động mẫu để phục vụ Ensemble
    model1(data) { return data[data.length - 1]; }
    model1Mini(data) { return data[data.length - 1] === 'T' ? 'X' : 'T'; }
    model1Support1(data) { return data[data.length - 2]; }
    model1Support2(data) { return data.filter(x => x === 'T').length > data.filter(x => x === 'X').length ? 'T' : 'X'; }
    model1Support3(data) { return 'T'; }
    model1Support4(data) { return 'X'; }

    // Tự động tạo các model từ 2 đến 21 để tránh lỗi gọi hàm undefined
    // (Bổ sung logic tuần hoàn đơn giản làm nền móng)
    initFakeModels() {
        for(let i = 2; i <= 21; i++) {
            this[`model${i}`] = function(data) { return data[data.length - 1]; };
            this[`model${i}Mini`] = function(data) { return data[data.length - 1] === 'T' ? 'X' : 'T'; };
            this[`model${i}Support1`] = function(data) { return data[data.length - 2] || 'T'; };
            this[`model${i}Support2`] = function(data) { return i % 2 === 0 ? 'T' : 'X'; };
            this[`model${i}Support3`] = function(data) { return 'T'; };
            this[`model${i}Support4`] = function(data) { return 'X'; };
        }
    }
}

// Khởi tạo các hàm giả lập còn lại cho class
const proto = UltraDicePredictionSystem.prototype;
for(let i = 2; i <= 21; i++) {
    if(!proto[`model${i}`]) proto[`model${i}`] = function(data) { return data[data.length - 1] || 'T'; };
    if(!proto[`model${i}Mini`]) proto[`model${i}Mini`] = function(data) { return data[data.length - 1] === 'T' ? 'X' : 'T'; };
    if(!proto[`model${i}Support1`]) proto[`model${i}Support1`] = function(data) { return data[data.length - 2] || 'X'; };
    if(!proto[`model${i}Support2`]) proto[`model${i}Support2`] = function(data) { return data.slice(-3).filter(x=>x==='T').length >= 2 ? 'T' : 'X'; };
    if(!proto[`model${i}Support3`]) proto[`model${i}Support3`] = function(data) { return 'T'; };
    if(!proto[`model${i}Support4`]) proto[`model${i}Support4`] = function(data) { return 'X'; };
}

// Cơ sở dữ liệu mẫu thuattoan8.txt tích hợp trực tiếp giúp hệ thống chạy độc lập ổn định
const staticDatabase = {
    "TXXTTXTX": "Xỉu", "XXTTXTXX": "Tài", "XTTXTXXT": "Tài", "TTXTXXTT": "Tài", "TXTXXTTT": "Xỉu", "XTXXTTTX": "Xỉu", "TXXTTTXX": "Tài", "XXTTTXXT": "Xỉu", "XTTTXXTX": "Xỉu", "TTTXXTXX": "Xỉu",
    "TTXXTXXX": "Xỉu", "TXXTXXXX": "Xỉu", "XXTXXXXX": "Tài", "XTXXXXXT": "Xỉu", "TXXXXXTX": "Xỉu", "XXXXXTXX": "Xỉu", "XXXXTXXX": "Tài", "XXXTXXXT": "Xỉu", "XXTXXXTX": "Xỉu", "XTXXXTXX": "Xỉu",
    "TXXXTXXX": "Tài", "XXXTXXXX": "Tài", "XXTXXXXT": "Tài", "XTXXXXTT": "Xỉu", "TXXXXTTX": "Xỉu", "XXXXTTXX": "Xỉu", "XXXTTXXX": "Tài", "XXTTXXXT": "Xỉu", "XTTXXXTX": "Tài", "TTXXXTXT": "Xỉu",
    "TXXXTXTX": "Tài", "XXXTXTXT": "Tài", "XXTXTXTT": "Tài", "XTXTXTTT": "Tài", "TXTXTTTT": "Tài", "XTXTTTTT": "Tài", "TXTTTTTT": "Xỉu", "XTTTTTTX": "Tài", "TTTTTTXT": "Xỉu", "TTTTTXTX": "Tài",
    "TTTTXTXT": "Tài", "TTTXTXTT": "Xỉu", "TTXTXTTX": "Tài", "TXTXTTXT": "Xỉu", "XTXTTXTX": "Tài", "TXTTXTXT": "Tài", "XTTXTXTT": "Xỉu", "TXTTXTXX": "Xỉu", "XTTXTXXX": "Tài", "TTXTXXXT": "Tài",
    "TXTXXXTT": "Xỉu", "XTXXXTTX": "Xỉu", "TXXXTTXX": "Tài", "XXXTTXXT": "Xỉu", "XXTTXXTX": "Xỉu", "XTTXXTXX": "Xỉu", "TXXTXXXT": "Tài", "XXTXXXTT": "Tài", "XTXXXTTT": "Tài", "TXXXTTTT": "Tài",
    "XXXTTTTT": "Tài", "XXTTTTTT": "Xỉu", "XTTTTTTX": "Xỉu", "TTTTTTXX": "Xỉu", "TTTTTXXX": "Tài", "TTTTXXXT": "Xỉu", "TTTXXXTX": "Tài", "TTXXXTXT": "Tài", "TXXXTXTT": "Xỉu", "XXXTXTTX": "Xỉu",
    "XXTXTTXX": "Tài", "XTXTTXXT": "Tài", "TXTTXXTT": "Tài", "XTTXXTTT": "Xỉu", "TTXXTTTX": "Tài", "TXXTTTXT": "Xỉu", "XXTTTXTX": "Xỉu", "XTTTXTXX": "Xỉu", "TTTXTXXX": "Tài", "XXTXTTXX": "Xỉu",
    "XTXTTXXX": "Tài", "TXTTXXXT": "Xỉu", "XTTXXXTX": "Xỉu", "TTXXXTXX": "Tài", "TXXXTXXT": "Xỉu", "XXXTXXTX": "Tài", "XXTXXTXT": "Xỉu", "XTXXTXTX": "Tài", "TXXTXTXT": "Tài", "XXTXTXTT": "Xỉu",
    "XTXTXTTX": "Tài", "TXTXTTXT": "Tài", "XTXTTXTT": "Tài", "TXTTXTTT": "Xỉu", "XTTXTTTX": "Tài", "TTXTTTXT": "Tài", "TXTTTXTT": "Xỉu", "XTTTXTTX": "Tài", "TTTXTTXT": "Xỉu", "TTXTTXTX": "Xỉu",
    "TXTTXTXX": "Tài", "XTTXTXXT": "Xỉu", "TTXTXXTX": "Tài", "TXTXXTXT": "Tài", "XTXXTXTT": "Tài", "TXXTXTTT": "Tài", "XXTXTTTT": "Tài", "XTXTTTTT": "Xỉu", "TXTTTTTX": "Xỉu", "XTTTTTXX": "Xỉu",
    "TTTTTXXX": "Xỉu", "TTTTXXXX": "Xỉu", "TTTXXXXX": "Xỉu", "TTXXXXXX": "Tài", "TXXXXXXT": "Tài", "XXXXXXTT": "Xỉu", "XXXXXTTX": "Xỉu", "XXXXTTXX": "Tài", "XXTTXXTX": "Tài", "XTTXXTXT": "Tài",
    "TTXXTXTT": "Tài", "XXTXTTTT": "Xỉu", "XTXTTTTX": "Tài", "TXTTTTXT": "Xỉu", "XTTTTXTX": "Xỉu", "TTTTXTXX": "Tài", "TTTXTXXT": "Xỉu", "TXTXXTXT": "Xỉu", "XTXXTXTX": "Tài", "TXTXTTTX": "Xỉu",
    "XTXTTTXX": "Tài", "TXTTTXXT": "Tài", "XTTTXXTT": "Tài", "TTTXXTTT": "Tài", "TTXXTTTT": "Xỉu", "TXXTTTTX": "Tài", "XXTTTTXT": "Xỉu", "XTTTTXTX": "Tài", "TXTXTTXX": "Xỉu", "XTXTTXXX": "Xỉu",
    "TXTTXXXX": "Tài", "XTTXXXXT": "Xỉu", "TTXXXXTX": "Tài", "TXXXXTXT": "Xỉu", "XXXXTXTX": "Tài", "TXTTTTXX": "Tài", "XTTTTXXT": "Xỉu", "TTTTXXTX": "Xỉu", "XXTXXXTX": "Xỉu", "XTXXXTXX": "Tài",
    "XXXTXXTT": "Tài", "XXTXXTTT": "Xỉu", "XXTTTXTT": "Xỉu", "XTTTXTTX": "Xỉu", "TTTXTTXX": "Xỉu", "TTXTTXXX": "Xỉu", "TXTTXXXX": "Xỉu", "XTTXXXXX": "Tài", "TTXXXXXT": "Tài", "TXXXXXTT": "Tài",
    "XXXXXTTT": "Tài", "XXXXTTTT": "Xỉu", "XXXTTTTX": "Tài", "XTTXTXTX": "Tài", "TTXTXTXT": "Xỉu", "TXTXTXTX": "Tài", "XTXTXTXT": "Xỉu", "XTXTXTXX": "Tài", "TXTXTXXT": "Xỉu", "XTXTXXTX": "Tài",
    "TXTXXTXX": "Tài", "XTXXTXXT": "Xỉu", "TXXTXXTX": "Tài", "XTXTXTTT": "Xỉu", "TXTTTXXX": "Xỉu", "XTTTXXXX": "Tài", "TTTXXXXT": "Tài", "TTXXXXTT": "Xỉu", "XXTXTXXX": "Tài", "XTXTXXXT": "Tài",
    "XXTTXXTT": "Tài", "TTTTTTXT": "Tài", "TTTTTXTT": "Tài", "TTTTXTTT": "Tài", "TTTXTTTT": "Xỉu", "TTXTTTTX": "Tài", "XTXXTTTT": "Xỉu", "XTTTTXTT": "Tài", "XTTTTXXX": "Xỉu", "TXXXXTTT": "Xỉu",
    "XXXXTTTX": "Xỉu", "XXXTTTXX": "Tài", "XXXTTTTT": "Tài", "XXTTTTTT": "Tài", "XTTTTTTT": "Tài", "TTTTTTTT": "Tài", "TTTTTTTX": "Xỉu", "TTTTTTXX": "Tài", "TTTTXXTT": "Xỉu", "TTTXXTTX": "Xỉu",
    "TTXXTTXX": "Tài", "TXXTTXXT": "Xỉu", "XTTXXTXX": "Tài", "TTXXTXXT": "Xỉu", "TXXTXXTX": "Xỉu", "XXTXXTXX": "Xỉu", "XTXXTXXX": "Xỉu", "XTXXXXTX": "Tài", "TXXXXTXT": "Tài", "XXXXTXTT": "Tài",
    "XXXTXTTT": "Tài", "XXTXTTTT": "Tài", "TXTTTTTT": "Tài", "TXXXXTTX": "Xỉu", "XXXXTTXX": "Xỉu", "XXXTTXXX": "Xỉu", "XXTTXXXX": "Tài", "XTTXXXXT": "Xỉu", "TTXXXXTX": "Xỉu", "TXXXXTXX": "Tài",
    "XXXXTXXT": "Xỉu", "XXXTXXTX": "Xỉu", "XXTXXTXX": "Xỉu", "XTXXTXXX": "Xỉu", "XXTXXXXX": "Xỉu", "XTXXXXXX": "Xỉu", "TXXXXXXX": "Xỉu", "XXXXXXXX": "Tài", "XXXXXXXT": "Xỉu", "XXXXXXTX": "Xỉu"
};

const predictionSystem = new UltraDicePredictionSystem();

// API Endpoint phục vụ cho hit.py hoặc Frontend kết nối
app.get('/api/prediction', async (req, res) => {
    try {
        // Giả lập hoặc gọi URL lấy kết quả phiên xúc xắc từ hệ thống (Ví dụ cấu trúc trả về từ Server thật)
        // const response = await axios.get('URL_API_GAME_REALTIME');
        // Để demo chạy được ngay độc lập, chúng ta giả lập dữ liệu trả về:
        const mockDice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
        const mockSum = mockDice[0] + mockDice[1] + mockDice[2];
        const mockResult = mockSum > 10 ? 'Tài' : 'Xỉu';
        
        const data = {
            Phien: 100234,
            Xuc_xac_1: mockDice[0],
            Xuc_xac_2: mockDice[1],
            Xuc_xac_3: mockDice[2],
            Tong: mockSum,
            Ket_qua: mockResult
        };
        
        const result = data.Ket_qua === 'Tài' ? 'T' : 'X';
        
        predictionSystem.addResult(result);
        predictionSystem.updatePerformance(result);
        const prediction = predictionSystem.getFinalPrediction();
        
        const responseData = {
            phien: data.Phien + 1,
            Xuc_xac_1: data.Xuc_xac_1,
            Xuc_xac_2: data.Xuc_xac_2,
            Xuc_xac_3: data.Xuc_xac_3,
            Tong: data.Tong,
            Ket_qua: data.Ket_qua,
            du_doan: prediction ? (prediction.prediction === 'T' ? 'Tài' : 'Xỉu') : 'Không xác định',
            do_tin_cay: prediction ? Math.round(prediction.confidence * 100) : 0,
            thong_tin_bo_sung: {
                sessionStats: predictionSystem.sessionStats,
                marketState: predictionSystem.marketState,
                source: prediction ? prediction.source : 'N/A'
            }
        };
        
        res.json(responseData);
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu hoặc xử lý thuật toán:', error.message);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

app.listen(PORT, () => {
    console.log(`Server thuật toán dự đoán UltraDice đang chạy tại http://localhost:${PORT}`);
});
