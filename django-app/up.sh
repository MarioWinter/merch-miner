git add .
git commit -m "$*"
git push
ssh mariowinter_sg@213.165.95.5 "cd home/dev/videoflix-backend-main && sudo git pull"