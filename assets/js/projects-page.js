// GitHub Projects Page JavaScript

(function() {
    'use strict';

    const GITHUB_USERNAME = 'shubharthaksangharsha';
    const ITEMS_PER_PAGE = 12;
    
    // Specific repos to display in order with descriptions
    const SELECTED_REPOS = [
        { name: 'karpathy', desc: 'Educational implementation inspired by Andrej Karpathy\'s teaching style' },
        { name: 'apsara2.5', desc: 'Latest Apsara voice assistant with web interface', link: 'https://apsara.devshubh.me' },
        { name: 'apsara2.0', desc: 'Enhanced version of Apsara voice assistant' },
        { name: 'apsaraAI', desc: 'AI-powered voice assistant with multiple integrations' },
        { name: 'power_extension', desc: 'Gemini Clipboard Assistant - Chrome/Edge extension that sends clipboard content or screenshots to Google\'s Gemini API with keyboard shortcuts' },
        { name: 'ai-website-generator', desc: 'AI-powered website generation tool' },
        { name: 'add2calendar', desc: 'Calendar integration application' },
        { name: 'AmericanSIgnLanguage', desc: 'American Sign Language recognition system' },
        { name: 'volume_hand_controller', desc: 'Control volume using hand gestures' },
        { name: 'FaceMaskDetection_usingTransferLearning', desc: 'Face mask detection using transfer learning' },
        { name: 'rag_implemenetation', desc: 'RAG (Retrieval-Augmented Generation) implementation' },
        { name: 'linkedin_job_submitter', desc: 'Automated LinkedIn job application submitter' },
        { name: 'face_attendance_system', desc: 'Facial recognition based attendance system' },
        { name: 'Voice-Based-Email-for-Visually-Challenged', desc: 'Voice-controlled email system for accessibility' },
        { name: 'ruby_rails_friends', desc: 'Ruby on Rails friends management app' },
        { name: 'Customer_Segmentation_Using_RFM_and_K-Means', desc: 'Customer segmentation using RFM analysis and K-Means clustering' },
        { name: 'Handwritten-Digit-Recognition-using-SVM-by-Shubharthak', desc: 'Handwritten digit recognition using SVM', displayName: 'Handwritten-Digit-Recognition-using-SVM' },
        { name: 'Online-Auction-Java-Servlet-MySQL', desc: 'Online auction system built with Java Servlets and MySQL' },
        { name: 'car_price_linear_regression', desc: 'Car price prediction using linear regression' },
        { name: 'presentation_controlling_using_hand_gesture', desc: 'Control presentations using hand gestures' },
        { name: 'qr_barcode_scanner', desc: 'QR code and barcode scanner application' },
        { name: 'object_detection_using_yoloV3classification', desc: 'Object detection using YOLOv3 classification' },
        { name: 'virtualCalculator', desc: 'Virtual calculator with gesture controls' },
        { name: 'snakeGame_openCV', desc: 'Snake game controlled using OpenCV' },
        { name: 'eye-counter', desc: 'Eye blink counter using computer vision' },
        { name: 'face-depth-measurement', desc: 'Face depth measurement system' },
        { name: 'tictactoe', desc: 'Interactive Tic-Tac-Toe game' }
    ];
    
    let allRepos = [];
    let filteredRepos = [];
    let currentPage = 1;
    let languages = new Set();
    let currentApsaraIndex = 0;
    let apsaraRepos = [];

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        fetchGitHubRepos();
        setupEventListeners();
    });

    // Fetch repositories from GitHub API
    async function fetchGitHubRepos() {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const grid = document.getElementById('projects-grid');
        const pagination = document.getElementById('pagination');

        try {
            loading.style.display = 'block';
            error.style.display = 'none';

            // Fetch all repos
            const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`);
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const githubRepos = await response.json();
            console.log('Total repos fetched from GitHub:', githubRepos.length);
            
            // Build repos from our predefined list with fallback to GitHub data
            allRepos = SELECTED_REPOS.map(repoConfig => {
                const githubRepo = githubRepos.find(r => r.name === repoConfig.name);
                
                if (githubRepo) {
                    // Merge our config with GitHub data
                    return {
                        ...githubRepo,
                        customDescription: repoConfig.desc,
                        customDisplayName: repoConfig.displayName,
                        customLink: repoConfig.link
                    };
                }
                return null;
            }).filter(repo => repo !== null);
            
            console.log('Total repos to display:', allRepos.length);
            
            // Store Apsara repos for rotation
            apsaraRepos = allRepos.filter(repo => 
                repo.name.toLowerCase().includes('apsara')
            );

            // Extract unique languages
            allRepos.forEach(repo => {
                if (repo.language) {
                    languages.add(repo.language);
                }
            });

            // Populate language filter
            populateLanguageFilter();

            // Initial display
            filteredRepos = [...allRepos];
            displayRepos();

            loading.style.display = 'none';
            grid.style.display = 'flex';
            pagination.style.display = 'flex';
            
            // Start Apsara rotation if there are multiple Apsara repos
            if (apsaraRepos.length > 1) {
                startApsaraRotation();
            }

        } catch (err) {
            console.error('Error fetching repos:', err);
            loading.style.display = 'none';
            error.style.display = 'block';
        }
    }

    // Populate language filter dropdown
    function populateLanguageFilter() {
        const languageFilter = document.getElementById('language-filter');
        const sortedLanguages = Array.from(languages).sort();

        sortedLanguages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            languageFilter.appendChild(option);
        });
    }

    // Display repositories
    function displayRepos() {
        const grid = document.getElementById('projects-grid');
        const totalPages = Math.ceil(filteredRepos.length / ITEMS_PER_PAGE);
        
        // Calculate start and end indices
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const reposToShow = filteredRepos.slice(startIndex, endIndex);

        // Clear grid
        grid.innerHTML = '';

        // Show empty state if no repos
        if (reposToShow.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-folder-open"></i>
                    <p>No projects found matching your criteria.</p>
                </div>
            `;
            document.getElementById('pagination').style.display = 'none';
            return;
        }

        // Create project cards
        reposToShow.forEach(repo => {
            const card = createProjectCard(repo);
            grid.appendChild(card);
        });

        // Update pagination
        updatePagination(totalPages);
    }

    // Create a project card
    function createProjectCard(repo) {
        const card = document.createElement('div');
        
        // Check if this is an Apsara repo for special styling
        const isApsara = repo.name.toLowerCase().includes('apsara');
        card.className = isApsara ? 'project-card apsara-card' : 'project-card';
        
        // Use custom display name if available
        const displayName = repo.customDisplayName || repo.name;
        
        // Use custom description if available, fallback to GitHub description
        const description = repo.customDescription || repo.description || `A ${repo.language || 'software'} project`;
        
        const language = repo.language || 'Unknown';
        const languageClass = `lang-${language.toLowerCase().replace(/[^a-z]/g, '')}`;
        const stars = repo.stargazers_count || 0;
        const forks = repo.forks_count || 0;
        const updatedDate = formatDate(repo.updated_at);
        
        // Use custom link if available, otherwise use GitHub URL
        const repoLink = repo.customLink || repo.html_url;
        const linkText = repo.customLink ? 'Live Demo' : 'View';
        const linkIcon = repo.customLink ? 'fas fa-external-link-alt' : 'fab fa-github';

        card.innerHTML = `
            <div class="project-card-header">
                <i class="fas fa-folder-open project-icon"></i>
                <div class="project-title">
                    <h3><a href="${repoLink}" target="_blank">${displayName}</a></h3>
                    ${repo.language ? `<span class="project-language"><span class="language-dot ${languageClass}"></span>${language}</span>` : ''}
                </div>
            </div>
            
            <p class="project-description">${description}</p>
            
            <div class="project-stats">
                <span class="stat">
                    <i class="fas fa-star"></i>
                    <span>${stars}</span>
                </span>
                <span class="stat">
                    <i class="fas fa-code-branch"></i>
                    <span>${forks}</span>
                </span>
            </div>
            
            <div class="project-footer">
                <span class="project-updated">Updated ${updatedDate}</span>
                <div class="project-links">
                    <a href="${repoLink}" target="_blank" class="project-link">
                        <i class="${linkIcon}"></i> ${linkText}
                    </a>
                </div>
            </div>
        `;

        return card;
    }
    
    // Start Apsara rotation (special timeline mode)
    function startApsaraRotation() {
        const apsaraCards = document.querySelectorAll('.apsara-card');
        if (apsaraCards.length <= 1) return;
        
        // Add navigation controls to first Apsara card only
        const navContainer = document.createElement('div');
        navContainer.className = 'apsara-navigation';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'apsara-nav-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => changeApsara('prev');
        
        // Dots container
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'apsara-dots';
        
        // Create dots
        for (let i = 0; i < apsaraCards.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'apsara-dot';
            if (i === 0) dot.classList.add('active');
            dot.onclick = () => changeApsara(i);
            dotsContainer.appendChild(dot);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'apsara-nav-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => changeApsara('next');
        
        navContainer.appendChild(prevBtn);
        navContainer.appendChild(dotsContainer);
        navContainer.appendChild(nextBtn);
        
        // Add navigation to each Apsara card
        apsaraCards.forEach(card => {
            const nav = navContainer.cloneNode(true);
            
            // Re-attach event listeners for cloned elements
            const clonedPrevBtn = nav.querySelector('.apsara-nav-btn:first-child');
            const clonedNextBtn = nav.querySelector('.apsara-nav-btn:last-child');
            const clonedDots = nav.querySelectorAll('.apsara-dot');
            
            clonedPrevBtn.onclick = () => changeApsara('prev');
            clonedNextBtn.onclick = () => changeApsara('next');
            clonedDots.forEach((dot, i) => {
                dot.onclick = () => changeApsara(i);
            });
            
            card.appendChild(nav);
        });
        
        // Function to change Apsara display
        function changeApsara(direction) {
            if (typeof direction === 'number') {
                currentApsaraIndex = direction;
            } else if (direction === 'next') {
                currentApsaraIndex = (currentApsaraIndex + 1) % apsaraCards.length;
            } else if (direction === 'prev') {
                currentApsaraIndex = (currentApsaraIndex - 1 + apsaraCards.length) % apsaraCards.length;
            }
            
            updateApsaraDisplay();
        }
        
        function updateApsaraDisplay() {
            // Hide all Apsara cards
            apsaraCards.forEach(card => {
                card.style.display = 'none';
            });
            
            // Show current Apsara
            if (apsaraCards[currentApsaraIndex]) {
                apsaraCards[currentApsaraIndex].style.display = 'flex';
            }
            
            // Update all dots
            document.querySelectorAll('.apsara-dot').forEach((dot, index) => {
                if (index % apsaraCards.length === currentApsaraIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
        
        // Initial display - no auto-rotation
        setTimeout(() => {
            updateApsaraDisplay();
        }, 100);
    }

    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    // Update pagination
    function updatePagination(totalPages) {
        const pagination = document.getElementById('pagination');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const pageNumbers = document.getElementById('page-numbers');

        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';

        // Update buttons
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Create page numbers
        pageNumbers.innerHTML = '';
        
        // Show max 7 page numbers with ellipsis
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // First page
        if (startPage > 1) {
            pageNumbers.appendChild(createPageNumber(1));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0.75em 0.5em';
                ellipsis.style.color = 'rgba(255,255,255,0.5)';
                pageNumbers.appendChild(ellipsis);
            }
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.appendChild(createPageNumber(i));
        }

        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0.75em 0.5em';
                ellipsis.style.color = 'rgba(255,255,255,0.5)';
                pageNumbers.appendChild(ellipsis);
            }
            pageNumbers.appendChild(createPageNumber(totalPages));
        }
    }

    // Create page number button
    function createPageNumber(pageNum) {
        const btn = document.createElement('button');
        btn.className = 'page-number';
        btn.textContent = pageNum;
        
        if (pageNum === currentPage) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', function() {
            currentPage = pageNum;
            displayRepos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        return btn;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', debounce(function(e) {
            applyFilters();
        }, 300));

        // Language filter
        const languageFilter = document.getElementById('language-filter');
        languageFilter.addEventListener('change', function() {
            applyFilters();
        });

        // Sort filter
        const sortFilter = document.getElementById('sort-filter');
        sortFilter.addEventListener('change', function() {
            applyFilters();
        });

        // Pagination buttons
        document.getElementById('prev-btn').addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                displayRepos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('next-btn').addEventListener('click', function() {
            const totalPages = Math.ceil(filteredRepos.length / ITEMS_PER_PAGE);
            if (currentPage < totalPages) {
                currentPage++;
                displayRepos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // Apply filters and sorting
    function applyFilters() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const languageFilter = document.getElementById('language-filter').value;
        const sortFilter = document.getElementById('sort-filter').value;

        // Filter
        filteredRepos = allRepos.filter(repo => {
            const matchesSearch = repo.name.toLowerCase().includes(searchTerm) || 
                                 (repo.description && repo.description.toLowerCase().includes(searchTerm));
            const matchesLanguage = languageFilter === 'all' || repo.language === languageFilter;
            return matchesSearch && matchesLanguage;
        });

        // Sort
        switch(sortFilter) {
            case 'stars':
                filteredRepos.sort((a, b) => b.stargazers_count - a.stargazers_count);
                break;
            case 'name':
                filteredRepos.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'updated':
            default:
                filteredRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                break;
        }

        // Reset to first page
        currentPage = 1;
        displayRepos();
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

})();

