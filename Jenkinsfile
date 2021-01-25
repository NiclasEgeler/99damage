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
                    sh 'npx tsc'
                }
            }
        }
        stage('Publish') {
            steps {
                load "$JENKINS_HOME/jobvars.env"

                withEnv(["NPM_TOKEN=${NPMJS_TOKEN}"]) {
                    sh 'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"em >> ~/.npmrc'
                    sh 'npm whoami'
                    sh 'npm publish'
                }
            }
        }
    }
}