// Add a listener to receive messages from the content script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "displayResponse") {
    var responseContainer = document.getElementById("response-container");
    responseContainer.innerText = JSON.stringify(message.response);
  }
});
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "removeLoading") {
    const loading = document.getElementById("loading");
    const status = document.getElementById("status");
    // remove the loading sign
    loading.classList.add("hidden");
    status.classList.remove("hidden");
    status.innerText = message.response;
    setTimeout(() => {
      if (message.response === "Thinking Completed!") {
        // close the popup
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            chrome.extension.getViews({ type: "popup" })[0].close();
          }
        );
      }
    }, 1000);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  var runBotButton = document.getElementById("runBot");
  const loading = document.getElementById("loading");
  const status = document.getElementById("status");
  runBotButton.addEventListener("click", function () {
    var eventDetailsTextarea = document.getElementById("event-details");
    var contactEmail = document.getElementById("contact-email");
    var eventDetails = eventDetailsTextarea.value.trim();

    // Check if event details textarea is empty
    if (eventDetails === "" || contactEmail === "") {
      eventDetailsTextarea.style.borderColor = "red";
      contactEmail.style.borderColor = "red";
      return;
    }

    eventDetailsTextarea.style.borderColor = ""; // Reset border color
    contactEmail.style.borderColor = "";

    eventDetailsTextarea.value += "\n contact email: " + contactEmail.value;

    // Show the loading sign
    loading.classList.remove("hidden");
    // Hide the status
    status.classList.add("hidden");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapeInputsAndRespond,
        args: [eventDetails, loading, status], // Pass event details as an argument
      });
    });
  });
});

function scrapeInputsAndRespond(eventDetails, loading, status) {
  // This function will be executed in the context of the active tab
  console.log("scrapeInputsAndRespond");

  // Scrape inputs and their labels
  var inputs = document.getElementsByTagName("input");
  var textareas = document.getElementsByTagName("textarea");
  var elements = Array.from(inputs).concat(Array.from(textareas));
  var results = [];
  var order = [];

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];

    var label = "";
    var labels = document.getElementsByTagName("label");
    for (var j = 0; j < labels.length; j++) {
      if (labels[j].htmlFor === element.id) {
        label = labels[j].innerText;
        break;
      }
    }
    if (label === "") continue;
    results.push(label);
    order.push({ label: label, value: element.value });
  }

  //   call http
  const url = "https://streetcodernate.pythonanywhere.com/chat";
  const requestData = {
    user_id: "user_1",
    query: {
      event_details: eventDetails,
      template_input_questions: results,
    },
    premium: true,
  };

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      xhr.status === 200
        ? // Hide the loading sign
          chrome.runtime.sendMessage({
            type: "removeLoading",
            response: "Thinking Completed!",
          })
        : chrome.runtime.sendMessage({
            type: "removeLoading",
            response: "Error",
          });

      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);

        // Parse the response string into an object
        const responseObject = JSON.parse(response);
        console.log(responseObject);
        // Update the input values from the response object
        for (var i = 0; i < results.length; i++) {
          var result = results[i];
          // Check if the label exists in the response object
          if (responseObject.hasOwnProperty(result)) {
            var valueFromResponse = responseObject[result];
            // Find the corresponding input element by label text
            var inputElement = elements.find(function (element) {
              var labelElement = document.querySelector(
                'label[for="' + element.id + '"]'
              );
              return labelElement && labelElement.innerText === result;
            });
            if (inputElement) {
              if (Array.isArray(valueFromResponse)) {
                valueFromResponse = valueFromResponse.join("\n");
              } else {
                inputElement.value = valueFromResponse;
              }
            }
          }
        }
      } else {
        console.error("HTTP request failed with status:", xhr.status);
      }
    }
  };

  xhr.send(JSON.stringify(requestData));
}
