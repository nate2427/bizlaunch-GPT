import os
import openai
import config
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import json

# Set the API key
openai.api_key = config.OPENAI_API_KEY

app = Flask(__name__)
CORS(app)


# ___ variables ___
user_data = {}

model="gpt-3.5-turbo"



system_prompt = "You are helpful assistant that \
creates SEO optimized descriptions for landing web page sections. \
Information will come as JSON data. \
\
you will receive incoming payload as \
{ \
  \"event_details\": \"Context of given event\" \
  \"template_input_questions\": [\"Section1\",\"Section2\"] \
} \
\
Value under event_details key gives general context describing topic for SEO optimized section descriptions. \
Values under template_input_questions key are individual sections of landing page. \
\
In your answer return only JSON payload formatted as \
{ \
  \"Section1\": \"SEO optimized description for Section1\", \
  \"Section2\": \"SEO optimized description for Section2\" \
} \
There can be arbitrary amount of web page related sections under the \
template_input_questions key. \
\
Example input: \
{ \
  \"event_details\": \"Welcome to the world of racing cars! Get ready for an adrenaline-fueled experience like no other.\", \
  \"template_input_questions\": [\"About Racing Cars\",\"Our Top Racing Car Models\",\"Experience the Thrill\"] \
\} \
\
Example output: \
\
{ \
\"About Racing Cars\": \"Unleash your passion for speed with our comprehensive guide about racing cars. Discover the rich history, cutting-edge technology, and the exhilarating world of motorsports. Get insights into the engineering marvels that power these machines and the skilled drivers who push the limits of performance.\", \
\"Our Top Racing Car Models\": \"Explore our collection of top racing car models designed to dominate the track. Each car embodies precision, power, and aerodynamics, delivering an unmatched driving experience. From sleek and agile roadsters to fierce and muscular supercars, our lineup combines style and performance to satisfy even the most discerning racing enthusiasts.\", \
\"Experience the Thrill\": \"Prepare for an unforgettable adrenaline rush as you step into the driver's seat. Experience the thrill of racing firsthand through our exhilarating driving experiences. Whether you're a seasoned pro or a novice, our expert instructors will guide you through high-speed laps, teaching you the techniques used by professional racers. Feel the G-forces, hear the roar of the engine, and immerse yourself in the world of racing.\" \
} \
\
Return JSON only. Do not output regular text, just JSON and purely JSON. \
"





def is_premium(user_id):
    return user_data.get(user_id, {}).get("premium", False)

def get_query_count(user_id):
    return user_data.get(user_id, {}).get("query_count", 0)

def increment_query_count(user_id):
    if user_id not in user_data:
        user_data[user_id] = {"query_count": 0, "premium": False}
    user_data[user_id]["query_count"] += 1

def set_premium(user_id, premium):
    if user_id not in user_data:
        user_data[user_id] = {"query_count": 0, "premium": premium}
    else:
        user_data[user_id]["premium"] = premium

def can_query(user_id):
    return is_premium(user_id) or get_query_count(user_id) < 5





def call_api(prompt, system_prompt):
    print(f"PROMPT: {prompt}")
    retries = 0
    while retries < 5:
        try:
            completion = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": json.dumps(prompt),
                    },
                ],

            )

            response = completion["choices"][0]["message"]["content"].strip()
            print(f"RESPONSE: {response}")
            return response

        except Exception as exc:
            print(exc)
            print("GPT API error, retrying in several seconds...")
            time.sleep(15)

            retries = retries + 1
            print("retries: ", retries)
            continue

        break




@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    prompt = data['query']
    user_id = data['user_id']
    premium = data.get("premium", False)
    
    set_premium(user_id, premium)

    if not can_query(user_id):
        return jsonify({"response": "You have reached the maximum number of queries for non-premium users. Please upgrade to premium."})

    increment_query_count(user_id)

    response = call_api(prompt, system_prompt)

    print('user data:', user_data)

    print(f'response:\n{response}')
    #return jsonify({"request": prompt, "response": response})
    return jsonify(response)



if __name__ == '__main__':
    app.run(debug=True, port=5001)

