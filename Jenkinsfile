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
                    sh 'npm ci'
                }
            }
        }
        stage('Version Check') {
            steps {
                script {
                    sh 'chmod 777 ci/version_check.sh'
                    sh 'ci/version_check.sh'
                }
            }
        }
        stage('Build') {
            steps {
                script {
                    sh 'npm run build'
                }
            }
        }
        stage('Publish') {
            steps {
                scripts {
                    sh 'npm publish'
                }
            }
        }
    }
}