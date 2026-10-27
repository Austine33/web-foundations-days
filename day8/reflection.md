# Reflection

## The most difficult concept
The most difficult concept for me in this course was how a cache and a database work together. It was hard because both of them store data, so at first I could not see why a system needs two places for the same information. I overcame it by reading the Day 7 notes again, drawing the architecture diagram step by step, and tracing one GET request and one POST request through each box until the order made sense. Now I understand that the cache is a fast shortcut for data people ask for often, while the database is the safe place that always holds the true answer.


## What I would improve in my capstone
Based on the feedback I received, I would improve my architecture diagram and the way I explained it. The feedback said the diagram had many boxes and I should explain why each one is there. To fix this, I would add a short sentence under every component that names the problem it solves, and I would practise explaining one request from start to finish without reading my notes.

## What I will learn next
Next, I want to learn how to build a real backend with Node.js and Express, and then connect it to a real database such as PostgreSQL. I chose this because I have designed the API and the data model on paper, and I want to see them work as real code. My first step will be to follow the Node.js and Express beginner guide and build one simple endpoint that returns a list of notes.