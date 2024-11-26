let model;
const video = document.getElementById("liveVideo");
const canvas = document.getElementById("parkingCanvas");
const ctx = canvas.getContext("2d");

let parkedCars = 0;
const detectedCars = [];
const carStayThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

const channelIPs = {
    1: "http:192.178.33.10/stream", // Replace with actual ESP32-CAM IP for channel 1
    2: "http://192.168.1.101:81/stream"  // Replace with actual ESP32-CAM IP for channel 2
};

async function loadModel() {
    model = await cocoSsd.load();
    changeChannel(1); // Default to channel 1
}

function changeChannel(channelNumber) {
    const channelTitle = document.getElementById("channelTitle");
    channelTitle.innerText = `Channel No.${channelNumber}`;
    
    const ip = channelIPs[channelNumber];
    if (ip) {
        video.src = ip; // Update the video source with the IP link
        video.load();   // Reload the video stream
        console.log(`Channel switched to: ${ip}`);
        video.onloadeddata = () => detectObjects();
    } else {
        console.error(`Invalid IP for channel ${channelNumber}`);
    }
}

async function detectObjects() {
    if (!model) return;
    const predictions = await model.detect(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const currentTime = Date.now();

    predictions.forEach((prediction) => {
        if (prediction.class === "car" && prediction.score > 0.5) {
            const [x, y, width, height] = prediction.bbox;
            ctx.strokeStyle = "red";
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);
            ctx.fillStyle = "red";
            ctx.fillText(`Car (${Math.round(prediction.score * 100)}%)`, x, y - 10);

            trackCar({ x, y, width, height }, currentTime);
        }
    });

    removeStaleCars(currentTime);
    requestAnimationFrame(detectObjects);
}

function trackCar(bbox, currentTime) {
    const car = detectedCars.find((car) => isSameCar(car.bbox, bbox));
    if (car) {
        car.lastSeen = currentTime;

        if (!car.isParked && currentTime - car.firstSeen >= carStayThreshold) {
            car.isParked = true;
            incrementCarCount();
        }
    } else {
        detectedCars.push({
            bbox,
            firstSeen: currentTime,
            lastSeen: currentTime,
            isParked: false
        });
    }
}

function removeStaleCars(currentTime) {
    const staleThreshold = 30 * 1000;
    detectedCars.forEach((car, index) => {
        if (currentTime - car.lastSeen > staleThreshold) {
            detectedCars.splice(index, 1);
        }
    });
}

function isSameCar(bbox1, bbox2) {
    const threshold = 50;
    return (
        Math.abs(bbox1.x - bbox2.x) < threshold &&
        Math.abs(bbox1.y - bbox2.y) < threshold &&
        Math.abs(bbox1.width - bbox2.width) < threshold &&
        Math.abs(bbox1.height - bbox2.height) < threshold
    );
}

function incrementCarCount() {
    parkedCars++;
    console.log(`Total Parked Cars: ${parkedCars}`);
}

function toggleFullScreen() {
    const videoContainer = document.querySelector(".video-container");
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else if (videoContainer) {
        videoContainer.requestFullscreen();
    }
}

loadModel();
