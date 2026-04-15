const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = "AIzaSyDFHTP2OK3NgsPlfVxu69yJTo2pTgrqbmM"; 
  console.log("--- Listando Modelos (v1beta) ---");
  try {
     const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
     const data = await response.json();
     console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao listar modelos:", error.message);
  }
}

listModels();
