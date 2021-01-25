pipeline {
    agent {
        docker {
            image 'node:15-alpine'
            args '-u root'
        }
    }
    stages {
        stage('Init'){
            steps {
                script {
                    sh 'npm i'
                }
            }
        }
        stage('Version Check') {
            steps {
                script {
                    sh 'chmod 777 ci/version_check.sh'
                    sh 'sh ci/version_check.sh'
                }
            }
        }
        stage('Build') {
            steps {
                script {
                    sh 'npm install -g npm@latest'
                    sh 'npx tsc'
                }
            }
        }
        stage('Publish') {
            steps {
                load "$JENKINS_HOME/jobvars.env"

                withEnv(["TOKEN=${NPMJS_TOKEN}"]) {
                    sh 'echo "//registry.npmjs.org/:_authToken=${TOKEN}" >> ~/.npmrc'
                    sh 'npm publish'
                }
            }
        }
    }
}