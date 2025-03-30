const HUGGINGFACE_API_KEY = "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";

let map, marker; // Declare variables globally

document.addEventListener("DOMContentLoaded", () => {
  // Initialize map
  initializeMap();

  // Initialize theme toggle
  initializeThemeToggle();
});

function initializeMap() {
    map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        zoomAnimation: true
    }).setView([48.8566, 2.3522], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        maxZoom: 19
    }).addTo(map);

    // Custom marker icon
    const customIcon = L.divIcon({
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -34]
    });

    marker = L.marker([48.8566, 2.3522], {
        icon: customIcon
    }).addTo(map);

    // Add smooth zoom
    map.options.zoomSnap = 0.1;
    map.options.zoomDelta = 0.5;
}

function initializeThemeToggle() {
  const themeToggleBtn = document.getElementById("themeToggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
      updateThemeIcon(themeToggleBtn);
    });
    // Set initial icon state
    updateThemeIcon(themeToggleBtn);
  }
}

function updateThemeIcon(button) {
  const icon = button.querySelector("i");
  if (icon) {
    icon.className = document.body.classList.contains("dark-mode")
      ? "fas fa-sun"
      : "fas fa-moon";
  }
}

async function updateMap() {
  let place = document.getElementById("placeName").value;
  let response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${place}`
  );
  let geoData = await response.json();

  if (geoData.length > 0) {
    let lat = parseFloat(geoData[0].lat);
    let lon = parseFloat(geoData[0].lon);
    map.setView([lat, lon], 10);
    marker.setLatLng([lat, lon]).bindPopup(`📍 ${place}`).openPopup();
  } else {
    alert("Location not found!");
  }
}

async function generateItinerary() {
  let place = document.getElementById("placeName").value;
  let numDays = parseInt(document.getElementById("numDays").value) || 3;
  let itineraryDiv = document.getElementById("itinerary");
  let loadingText = document.getElementById("loading");

  loadingText.style.display = "block"; // Show loading indicator
  itineraryDiv.innerHTML = ""; // Clear previous results

  let prompt = `Give me a detailed ${numDays}-day travel itinerary for ${place}, including morning, afternoon, and evening activities.`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_length: 800 },
        }),
      }
    );

    const aiResponse = await response.json();
    loadingText.style.display = "none"; // Hide loading

    if (!aiResponse || aiResponse.error)
      throw new Error("Failed to get AI response");

    let generatedText =
      aiResponse[0]?.generated_text || "No data received from AI.";

    formatItinerary(generatedText);
  } catch (error) {
    loadingText.style.display = "none";
    itineraryDiv.innerHTML = `<p>⚠️ Error: ${error.message}</p>`;
  }
}

// Function to Format Itinerary Text Properly
function formatItinerary(rawText) {
  let itineraryDiv = document.getElementById("itinerary");
  itineraryDiv.innerHTML = ""; // Clear previous data

  let structuredHTML = `<h3><i class="fas fa-map-marked-alt"></i> Travel Itinerary</h3>`;

  // Splitting into Days
  let days = rawText.split(/Day \d+:/);
  days.shift();

  days.forEach((dayText, index) => {
      let lines = dayText.trim().split("\n").filter(line => line.trim() !== "");
      let dayTitle = `Day ${index + 1}`;
      structuredHTML += `
          <div class="itinerary-item">
              <h3><i class="fas fa-calendar-day"></i> ${dayTitle}</h3>
      `;
  
      let timeSlots = { Morning: [], Afternoon: [], Evening: [] };
      let currentTime = "";
  
      lines.forEach(line => {
          if (line.match(/^(Morning|Afternoon|Evening):/)) {
              currentTime = line.replace(":", "").trim();
          } else if (currentTime) {
              timeSlots[currentTime].push(line.trim());
          }
      });
  
      Object.keys(timeSlots).forEach(time => {
          if (timeSlots[time].length > 0) {
              let timeIcon = time === 'Morning' ? 'fa-sun' : 
                           time === 'Afternoon' ? 'fa-cloud-sun' : 'fa-moon';
              
              structuredHTML += `
                  <h4><i class="fas ${timeIcon}"></i> ${time}</h4>
                  <ul>
              `;
              
              timeSlots[time].forEach(activity => {
                  structuredHTML += `
                      <li><i class="fas fa-check-circle"></i> ${activity}</li>
                  `;
              });
              
              structuredHTML += '</ul>';
          }
      });
  
      structuredHTML += '</div>';
  });

  itineraryDiv.innerHTML = structuredHTML;
  animateItinerary();
}

// Smooth Appearance Animation using Anime.js
function animateItinerary() {
  anime({
    targets: ".itinerary-item",
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(200),
    easing: "easeOutExpo",
  });
}
