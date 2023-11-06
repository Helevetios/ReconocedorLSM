import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";
const demosSection = document.getElementById("demos");
const predictButton = document.getElementById('predict');
let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
let modelCustom;
let predict = false;

const createHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    demosSection.classList.remove("invisible");
};

createHandLandmarker();


const VIDEO = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
const hasGetUserMedia = () => { var _a; return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia); };
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
function enableCam(event) {
    predict = true;
    if (!handLandmarker) {
        console.log("Wait! objectDetector not loaded yet.");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        predictButton.style.display = "block";
        enableWebcamButton.remove();
    }
    // getUsermedia parameters.
    const constraints = {
        video: true,
        width: 640,
        height: 480
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        VIDEO.srcObject = stream;
        VIDEO.addEventListener("loadeddata", predictWebcam);
        videoPlaying = true;
    });



    predictLoop()
}
let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
    canvasElement.style.width = VIDEO.videoWidth;
    ;
    canvasElement.style.height = VIDEO.videoHeight;
    canvasElement.width = VIDEO.videoWidth;
    canvasElement.height = VIDEO.videoHeight;

    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== VIDEO.currentTime) {
        lastVideoTime = VIDEO.currentTime;
        results = handLandmarker.detectForVideo(VIDEO, startTimeMs);
    }
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
            });
            drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
        }
    }
    canvasCtx.restore();
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}

const STATUS = document.getElementById('status');
const PREDICT = document.getElementById('predict');
PREDICT.innerText = 'Sin modelos para predecir';
const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;
const STOP_DATA_GATHER = -1;
let CLASS_NAMES = [];


CLASS_NAMES.push('0')
CLASS_NAMES.push('1')


let mobilenet = undefined;
let gatherDataState = STOP_DATA_GATHER;
let videoPlaying = false;


async function loadMobileNetFeatureModel() {
    const URL = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';
    mobilenet = await tf.loadGraphModel(URL, { fromTFHub: true });
    STATUS.innerText = 'Modelos cargados correctamente';

    // Warm up the model by passing zeros through it once.
    tf.tidy(function () {
        let answer = mobilenet.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]));
        console.log(answer.shape);
    });
}

loadMobileNetFeatureModel();

let model = tf.sequential();
model.add(tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' }));
model.add(tf.layers.dense({ units: CLASS_NAMES.length, activation: 'softmax' }));

model.summary();

model.compile({
    // Adam changes the learning rate over time which is useful.
    optimizer: 'adam',
    // Use the correct loss function. If 2 classes of data, must use binaryCrossentropy.
    // Else categoricalCrossentropy is used if more than 2 classes.
    loss: (CLASS_NAMES.length === 2) ? 'binaryCrossentropy' : 'categoricalCrossentropy',
    // As this is a classification problem you can record accuracy in the logs too!
    metrics: ['accuracy']
});

function predictLoop() {
    if (predict) {
        tf.tidy(function () {
            let imageFeatures = calculateFeaturesOnCurrentFrame();
            let prediction = modelCustom.predict(imageFeatures.expandDims()).squeeze();
            let highestIndex = prediction.argMax().arraySync();
            let predictionArray = prediction.arraySync();
            PREDICT.innerText = 'Prediccion: ' + CLASS_NAMES[highestIndex] + ' con ' + Math.floor(predictionArray[highestIndex] * 100) + '% confianza';
        });

        window.requestAnimationFrame(predictLoop);
    }
}

function calculateFeaturesOnCurrentFrame() {
    return tf.tidy(function () {
        // Grab pixels from current VIDEO frame.
        console.log
        let videoFrameAsTensor = tf.browser.fromPixels(canvasElement);
        // Resize video frame tensor to be 224 x 224 pixels which is needed by MobileNet for input.
        let resizedTensorFrame = tf.image.resizeBilinear(
            videoFrameAsTensor,
            [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH],
            true
        );

        let normalizedTensorFrame = resizedTensorFrame.div(255);

        return mobilenet.predict(normalizedTensorFrame.expandDims()).squeeze();
    });
}



function logProgress(epoch, logs) {
    console.log('Data for epoch ' + epoch, logs);
}


var dropdownMenu = document.querySelector('.dropdown-menu');

dropdownMenu.addEventListener('click', function (event) {
    // Evitar que el enlace se comporte como un enlace normal
    event.preventDefault();

    // Obtener la opción seleccionada
    var selectedOption = event.target.textContent;

    load(selectedOption.toLowerCase());
});

async function load(option) {
    console.log(option)
    let URL = '/models/' + option + '/'
    modelCustom = await tf.loadLayersModel(URL + 'modelCustom.json');
    modelCustom.summary();
    CLASS_NAMES = []
    CLASS_NAMES.push('Palma')
    CLASS_NAMES.push(option.toUpperCase())
    predictLoop()
}