FROM node:latest

# Define a pasta de trabalho do container
WORKDIR /usr/src/app

# Copia os arquivos do projeto para a pasta de trabalho
COPY . .

# Instala as dependências do projeto
RUN yarn

# Constroi o projeto
RUN yarn build

# Expõe a porta que o aplicativo vai escutar
EXPOSE 8080

# Define o comando padrão para iniciar o aplicativo
CMD ["yarn", "start"]
w