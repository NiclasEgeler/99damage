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

                withCredentials([usernamePassword(credentialsId: 'credential-npm', usernameVariable: 'NPM_USER', passwordVariable: 'NPM_PASS'), string(credentialsId: 'npm-email', variable: 'NPM_MAIL')]) {
                    sh 'npm install -g npm-cli-login'
                    sh 'npm-cli-login -u ${NPM_USER} -p {NPM_PASS} -e {NPM_MAIL}'
                    sh 'npm publish --verbose'
                }
            }
        }
    }
}