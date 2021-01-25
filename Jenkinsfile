pipeline {
    agent {

        docker {
            image 'node:10-alpine' 
            args '-u root' 
        }
    }

    stages {

        stage('Install') { 
            steps {
                sh 'npm install' 
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